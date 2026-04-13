<script lang="ts">
	import '../app.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import { bannerItems, setBannerItems, type BannerItem } from '$lib/stores/bannerItems';
	import {
		dashboardConversation,
		removeDashboardConversationSession,
		selectDashboardConversationSession
	} from '$lib/stores/dashboardConversation';
	import { sidebarCollapsed, initSidebarStore } from '$lib/stores/sidebar';
	import ButtonWithMenu from '$lib/components/ButtonWithMenu.svelte';

	let { children } = $props();

	const getTenantBasePath = () => '/hospital';
	const profileHref = () => `${getTenantBasePath()}/profile`;
	const settingsHref = () => `${getTenantBasePath()}/settings`;

	const isLogin = () => page.url.pathname === '/login';
	const isProfile = () => page.url.pathname === profileHref();
	const isSettings = () => page.url.pathname === settingsHref();

	const pollIntervalMs = 60_000;
	let appViewportWidth = $state('100vw');
	let appViewportHeight = $state('100vh');
	let appViewportWidthPx = $state(0);
	let appViewportHeightPx = $state(0);
	let alarmPanelOpen = $state(false);
	let alarmPanelRef = $state<HTMLElement | null>(null);
	let alarmButtonRef = $state<HTMLButtonElement | null>(null);
	let alarmFabX = $state(18);
	let alarmFabY = $state(18);
	let alarmFabReady = $state(false);

	let alarmDragPointerId: number | null = null;
	let alarmDragStartX = 0;
	let alarmDragStartY = 0;
	let alarmFabStartX = 0;
	let alarmFabStartY = 0;
	let alarmIsDragging = false;
	let suppressAlarmToggleOnce = false;
	let deletingSessionId = $state<number | null>(null);

	type AmbientGlowTone = 'ice' | 'blue' | 'mist';
	type AmbientGlow = {
		x: string;
		y: string;
		size: string;
		blur: string;
		opacity: string;
		duration: string;
		delay: string;
	};

	const isDashboard = () => page.url.pathname.endsWith('/chat');
	let ambientGlowIce = $state<AmbientGlow>({
		x: '16%',
		y: '16%',
		size: '34vmax',
		blur: '92px',
		opacity: '0.18',
		duration: '9600ms',
		delay: '0ms'
	});
	let ambientGlowBlue = $state<AmbientGlow>({
		x: '78%',
		y: '24%',
		size: '28vmax',
		blur: '104px',
		opacity: '0.16',
		duration: '8400ms',
		delay: '1200ms'
	});
	let ambientGlowMist = $state<AmbientGlow>({
		x: '62%',
		y: '80%',
		size: '32vmax',
		blur: '98px',
		opacity: '0.14',
		duration: '10400ms',
		delay: '2200ms'
	});
	let ambientMotionEnabled = $state(false);
	let ambientRefreshTimer: number | null = null;

	const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

	const createAmbientGlow = (tone: AmbientGlowTone, isStatic = false): AmbientGlow => {
		const presets = {
			ice: { x: '16%', y: '16%', size: '34vmax', blur: '92px', opacity: '0.18', duration: '9600ms', delay: '0ms' },
			blue: { x: '78%', y: '24%', size: '28vmax', blur: '104px', opacity: '0.16', duration: '8400ms', delay: '1200ms' },
			mist: { x: '62%', y: '80%', size: '32vmax', blur: '98px', opacity: '0.14', duration: '10400ms', delay: '2200ms' }
		} satisfies Record<AmbientGlowTone, AmbientGlow>;

		if (isStatic) {
			return presets[tone];
		}

		return {
			x: `${Math.round(randomBetween(10, 90))}%`,
			y: `${Math.round(randomBetween(10, 88))}%`,
			size: `${Math.round(randomBetween(24, tone === 'blue' ? 36 : 42))}vmax`,
			blur: `${Math.round(randomBetween(78, 126))}px`,
			opacity: `${randomBetween(0.12, tone === 'mist' ? 0.18 : 0.24).toFixed(2)}`,
			duration: `${Math.round(randomBetween(6400, 11800))}ms`,
			delay: `${Math.round(randomBetween(0, 2200))}ms`
		};
	};

	const ambientGlowStyle = (glow: AmbientGlow) =>
		`left: ${glow.x}; top: ${glow.y}; width: ${glow.size}; height: ${glow.size}; opacity: ${glow.opacity}; filter: blur(${glow.blur}); animation-duration: ${glow.duration}; animation-delay: ${glow.delay};`;

	const applyAmbientGlowSet = (isStatic = false) => {
		ambientGlowIce = createAmbientGlow('ice', isStatic);
		ambientGlowBlue = createAmbientGlow('blue', isStatic);
		ambientGlowMist = createAmbientGlow('mist', isStatic);
	};

	const stopAmbientGlowRefresh = () => {
		if (!ambientRefreshTimer) return;
		clearTimeout(ambientRefreshTimer);
		ambientRefreshTimer = null;
	};

	const queueAmbientGlowRefresh = () => {
		stopAmbientGlowRefresh();
		if (!ambientMotionEnabled || typeof window === 'undefined') {
			applyAmbientGlowSet(true);
			return;
		}

		ambientRefreshTimer = window.setTimeout(() => {
			const nextGlow = Math.floor(Math.random() * 3);
			if (nextGlow === 0) ambientGlowIce = createAmbientGlow('ice');
			if (nextGlow === 1) ambientGlowBlue = createAmbientGlow('blue');
			if (nextGlow === 2) ambientGlowMist = createAmbientGlow('mist');
			queueAmbientGlowRefresh();
		}, Math.round(randomBetween(1800, 4200)));
	};

	const syncAmbientMotionPreference = () => {
		if (typeof window === 'undefined') return;
		ambientMotionEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	};

	const bindMediaQueryChange = (
		query: MediaQueryList,
		handler: (event: MediaQueryListEvent) => void
	) => {
		if ('addEventListener' in query) {
			query.addEventListener('change', handler);
			return () => query.removeEventListener('change', handler);
		}

		const legacyQuery = query as MediaQueryList & {
			addListener: (listener: (event: MediaQueryListEvent) => void) => void;
			removeListener: (listener: (event: MediaQueryListEvent) => void) => void;
		};
		legacyQuery.addListener(handler);
		return () => legacyQuery.removeListener(handler);
	};

	const updateViewportBounds = () => {
		if (typeof window === 'undefined') return;
		const viewport = window.visualViewport;
		const nextWidth = viewport?.width ?? window.innerWidth;
		const nextHeight = viewport?.height ?? window.innerHeight;
		appViewportWidthPx = Math.round(nextWidth);
		appViewportHeightPx = Math.round(nextHeight);
		appViewportWidth = `${Math.round(nextWidth)}px`;
		appViewportHeight = `${Math.round(nextHeight)}px`;

		if (alarmFabReady) {
			const next = clampAlarmFabPosition(alarmFabX, alarmFabY);
			alarmFabX = next.x;
			alarmFabY = next.y;
		}
	};

	const refreshBannerItems = async () => {
		if (isLogin()) return;
		try {
			const response = await fetch('/api/banner-items');
			if (!response.ok) return;
			const payload = await response.json();
			setBannerItems(payload.items ?? []);
		} catch {
			return;
		}
	};

	type OrderBannerLink = {
		action?: 'open-order-modal';
		targetDrugId?: string;
		targetLabel?: string;
	};

	const toOrderBannerLink = (banner: unknown) => banner as OrderBannerLink;
	const toBannerItem = (banner: unknown) => banner as BannerItem;

	const getWarnAlarmCount = () => $bannerItems.filter((item) => item.level === 'warn').length;

	const getAlarmButtonLabel = () => {
		const warnCount = getWarnAlarmCount();
		return warnCount > 0 ? `경보 ${warnCount}` : `알림 ${$bannerItems.length}`;
	};

	const clampAlarmFabPosition = (x: number, y: number) => {
		const buttonWidth = alarmButtonRef?.offsetWidth ?? 0;
		const buttonHeight = alarmButtonRef?.offsetHeight ?? 0;
		const maxX = Math.max(18, appViewportWidthPx - buttonWidth - 18);
		const maxY = Math.max(18, appViewportHeightPx - buttonHeight - 18);

		return {
			x: Math.min(maxX, Math.max(18, x)),
			y: Math.min(maxY, Math.max(18, y))
		};
	};

	const getAlarmFabStyle = () =>
		alarmFabReady ? `left: ${alarmFabX}px; top: ${alarmFabY}px;` : 'right: 18px; bottom: 18px;';

	const getAlarmPanelStyle = () => {
		const panelWidth = Math.min(420, Math.max(280, appViewportWidthPx - 36));
		const panelHeight = alarmPanelRef?.offsetHeight ?? Math.min(640, Math.round(appViewportHeightPx * 0.68));
		const buttonHeight = alarmButtonRef?.offsetHeight ?? 52;
		const left = Math.min(Math.max(18, alarmFabX), Math.max(18, appViewportWidthPx - panelWidth - 18));
		const aboveTop = alarmFabY - panelHeight - 12;
		const belowTop = alarmFabY + buttonHeight + 12;
		const top =
			aboveTop >= 18
				? aboveTop
				: Math.min(Math.max(18, belowTop), Math.max(18, appViewportHeightPx - panelHeight - 18));

		return `left: ${left}px; top: ${top}px;`;
	};

	const initializeAlarmFabPosition = async () => {
		if (typeof window === 'undefined') return;
		await tick();
		const buttonWidth = alarmButtonRef?.offsetWidth ?? 156;
		const buttonHeight = alarmButtonRef?.offsetHeight ?? 52;
		alarmFabX = Math.max(18, appViewportWidthPx - buttonWidth - 18);
		alarmFabY = Math.max(18, appViewportHeightPx - buttonHeight - 18);
		alarmFabReady = true;
	};

	const dispatchNewSessionRequest = () => {
		if (typeof window === 'undefined') return;
		window.dispatchEvent(new Event('dashboard-new-session-request'));
	};

	const handleCreateSessionFromSidebar = async () => {
		if (isDashboard()) {
			dispatchNewSessionRequest();
			return;
		}

		await goto(`${getTenantBasePath()}/chat?newSession=1`);
	};

	const deleteSession = async (sessionId: number) => {
		if (deletingSessionId === sessionId) return;
		deletingSessionId = sessionId;

		try {
			const response = await fetch(`/api/chat/sessions?sessionId=${encodeURIComponent(String(sessionId))}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(
					typeof payload?.message === 'string' ? payload.message : '대화 세션을 삭제하지 못했습니다.'
				);
			}

			removeDashboardConversationSession(sessionId);
		} catch (error) {
			console.error(error);
		} finally {
			deletingSessionId = null;
		}
	};

	const handleAlarmButtonClick = () => {
		if (suppressAlarmToggleOnce) {
			suppressAlarmToggleOnce = false;
			return;
		}

		alarmPanelOpen = !alarmPanelOpen;
	};

	const handleAlarmPointerDown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		alarmDragPointerId = event.pointerId;
		alarmDragStartX = event.clientX;
		alarmDragStartY = event.clientY;
		alarmFabStartX = alarmFabX;
		alarmFabStartY = alarmFabY;
		alarmIsDragging = false;
		alarmButtonRef?.setPointerCapture(event.pointerId);
	};

	const handleAlarmPointerMove = (event: PointerEvent) => {
		if (alarmDragPointerId !== event.pointerId) return;
		const deltaX = event.clientX - alarmDragStartX;
		const deltaY = event.clientY - alarmDragStartY;

		if (!alarmIsDragging && Math.hypot(deltaX, deltaY) < 4) return;
		alarmIsDragging = true;
		const next = clampAlarmFabPosition(alarmFabStartX + deltaX, alarmFabStartY + deltaY);
		alarmFabX = next.x;
		alarmFabY = next.y;
	};

	const finishAlarmDrag = (event: PointerEvent) => {
		if (alarmDragPointerId !== event.pointerId) return;
		if (alarmButtonRef?.hasPointerCapture(event.pointerId)) {
			alarmButtonRef.releasePointerCapture(event.pointerId);
		}
		if (alarmIsDragging) {
			suppressAlarmToggleOnce = true;
		}
		alarmDragPointerId = null;
		alarmIsDragging = false;
	};

	const handleBannerClick = async (banner: unknown) => {
		const orderLink = toOrderBannerLink(banner);
		if (orderLink.action !== 'open-order-modal' || !orderLink.targetDrugId) return;
		const url = new URL(`${getTenantBasePath()}/chat`, page.url.origin);
		url.searchParams.set('openOrderDrugId', orderLink.targetDrugId);
		if (orderLink.targetLabel) {
			url.searchParams.set('openOrderLabel', orderLink.targetLabel);
		}
		await goto(`${url.pathname}${url.search}`);
	};

	const handleAlarmCardClick = async (banner: BannerItem) => {
		alarmPanelOpen = false;
		if (toOrderBannerLink(banner).action === 'open-order-modal') {
			await handleBannerClick(banner);
		}
	};

	$effect(() => {
		if (!isLogin()) {
			refreshBannerItems();
		}
	});

	onMount(() => {
		initSidebarStore();
		updateViewportBounds();
		void initializeAlarmFabPosition();
		syncAmbientMotionPreference();
		applyAmbientGlowSet(!ambientMotionEnabled);
		queueAmbientGlowRefresh();
		const viewport = window.visualViewport;
		const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onBannerRefreshRequest = () => {
			refreshBannerItems();
		};
		const onDocumentClick = (event: MouseEvent) => {
			if (!alarmPanelOpen) return;
			const target = event.target as Node;
			if (alarmPanelRef?.contains(target) || alarmButtonRef?.contains(target)) return;
			alarmPanelOpen = false;
		};
		const onDocumentKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				alarmPanelOpen = false;
			}
		};
		const onMotionPreferenceChange = () => {
			syncAmbientMotionPreference();
			queueAmbientGlowRefresh();
		};
		const disposeReducedMotionListener = bindMediaQueryChange(reducedMotionQuery, onMotionPreferenceChange);
		window.addEventListener('banner-refresh-request', onBannerRefreshRequest);
		window.addEventListener('resize', updateViewportBounds);
		document.addEventListener('click', onDocumentClick);
		document.addEventListener('keydown', onDocumentKeydown);
		viewport?.addEventListener('resize', updateViewportBounds);
		const interval = setInterval(refreshBannerItems, pollIntervalMs);
		return () => {
			clearInterval(interval);
			stopAmbientGlowRefresh();
			window.removeEventListener('banner-refresh-request', onBannerRefreshRequest);
			window.removeEventListener('resize', updateViewportBounds);
			document.removeEventListener('click', onDocumentClick);
			document.removeEventListener('keydown', onDocumentKeydown);
			viewport?.removeEventListener('resize', updateViewportBounds);
			disposeReducedMotionListener();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href="/company_logo.png" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
	/>
	<title>MTECH</title>
	<meta name="description" content="MTECH" />
</svelte:head>

<div class="liquid-ambient" aria-hidden="true">
	<span class="ambient-glow ambient-glow-ice" style={ambientGlowStyle(ambientGlowIce)}></span>
	<span class="ambient-glow ambient-glow-blue" style={ambientGlowStyle(ambientGlowBlue)}></span>
	<span class="ambient-glow ambient-glow-mist" style={ambientGlowStyle(ambientGlowMist)}></span>
</div>

{#if isLogin()}
	<main class="login-shell liquid-login">
		{@render children()}
	</main>
{:else}
	<div
		class="app-shell liquid-shell"
		class:sidebar-collapsed={$sidebarCollapsed}
		class:dashboard-shell={isDashboard()}
		style={`--app-viewport-width: ${appViewportWidth}; --app-viewport-height: ${appViewportHeight};`}
	>
		<aside class="sidebar glass">
			<div class="sidebar-header">
				<div class="sidebar-top-strip" aria-label="주요 탐색">
					{#if !$sidebarCollapsed}
						<a
							class="sidebar-utility-button"
							class:is-active={isProfile()}
							href={profileHref()}
							aria-label="프로필"
							title="프로필"
						>
							<span class="material-symbols-outlined">account_circle</span>
						</a>
						<a
							class="sidebar-utility-button"
							class:is-active={isSettings()}
							href={settingsHref()}
							aria-label="설정"
							title="설정"
						>
							<span class="material-symbols-outlined">settings</span>
						</a>
						<button
							type="button"
							class="sidebar-utility-button"
							onclick={handleCreateSessionFromSidebar}
							aria-label="새 세션"
							title="새 세션"
						>
							<span class="material-symbols-outlined">add_comment</span>
						</button>
					{/if}
					<button
						type="button"
						class="sidebar-utility-button"
						onclick={() => sidebarCollapsed.toggle()}
						aria-label={$sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						title={$sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					>
						<span class="material-symbols-outlined">
							{$sidebarCollapsed ? 'right_panel_open' : 'left_panel_close'}
						</span>
					</button>
				</div>
				<div class="brand">
					<img src="/company_logo.png" alt="MTECH" class="brand-logo" />
				</div>
			</div>

			<div class="sidebar-body">
				{#if !$sidebarCollapsed && isDashboard()}
					<section class="sidebar-session-log" aria-label="채팅 세션 기록">
						<div class="sidebar-session-list">
							{#each $dashboardConversation.sessions as session (session.id)}
								<ButtonWithMenu
									label={session.title}
									isActive={session.id === $dashboardConversation.activeSessionId}
									ariaCurrent={session.id === $dashboardConversation.activeSessionId ? 'page' : undefined}
									onclick={() => selectDashboardConversationSession(session.id)}
									menuItems={[
										{
											label: deletingSessionId === session.id ? '삭제 중...' : 'Delete',
											danger: true,
											disabled: deletingSessionId === session.id,
											onclick: () => void deleteSession(session.id)
										}
									]}
								/>
							{/each}
						</div>
					</section>
				{/if}
			</div>

			{#if !$sidebarCollapsed}
				<div class="sidebar-controls">
					<form method="POST" action="/logout">
						<button type="submit" class="sidebar-action sidebar-logout">Logout</button>
					</form>
				</div>
			{:else}
				<div class="sidebar-controls sidebar-controls-collapsed">
					<form method="POST" action="/logout">
						<button type="submit" class="sidebar-action-icon sidebar-logout" title="Logout">
							<span class="material-symbols-outlined">logout</span>
						</button>
					</form>
				</div>
			{/if}
		</aside>

		<div class="main">
			<main class="content">
				{@render children()}
			</main>
		</div>
	</div>

	<button
		type="button"
		class="alarm-fab"
		bind:this={alarmButtonRef}
		style={getAlarmFabStyle()}
		aria-label="알림 열기"
		aria-expanded={alarmPanelOpen}
		aria-controls="alarm-panel"
		onclick={handleAlarmButtonClick}
		onpointerdown={handleAlarmPointerDown}
		onpointermove={handleAlarmPointerMove}
		onpointerup={finishAlarmDrag}
		onpointercancel={finishAlarmDrag}
	>
		<span class="material-symbols-outlined">notifications_active</span>
		<span class="alarm-fab-label">{getAlarmButtonLabel()}</span>
		{#if getWarnAlarmCount() > 0}
			<span class="alarm-fab-badge">{getWarnAlarmCount()}</span>
		{/if}
	</button>

	{#if alarmPanelOpen}
		<section class="alarm-panel" id="alarm-panel" bind:this={alarmPanelRef} style={getAlarmPanelStyle()} aria-label="실시간 알림 목록">
			<div class="alarm-panel-header">
				<div>
					<div class="alarm-panel-eyebrow">Realtime Alerts</div>
					<h2>운영 알림</h2>
				</div>
				<button type="button" class="alarm-panel-close" aria-label="알림 닫기" onclick={() => (alarmPanelOpen = false)}>
					<span class="material-symbols-outlined">close</span>
				</button>
			</div>

			<div class="alarm-panel-meta muted">
				긴급 경보 {getWarnAlarmCount()}건, 전체 알림 {$bannerItems.length}건
			</div>

			<div class="alarm-panel-list">
				{#each $bannerItems as banner (toBannerItem(banner).id)}
					{#if toOrderBannerLink(banner).action === 'open-order-modal'}
						<button
							type="button"
							class="alarm-card is-clickable"
							class:is-warn={banner.level === 'warn'}
							onclick={() => handleAlarmCardClick(toBannerItem(banner))}
						>
							<div class="alarm-card-head">
								<div class="alarm-card-title-wrap">
									<span class="status-dot" class:is-warn={banner.level === 'warn'}></span>
									<span class="alarm-card-title">{banner.title}</span>
								</div>
								<span class="alarm-card-action">대시보드에서 열기</span>
							</div>
							<div class="alarm-card-preview">{banner.preview}</div>
							<div class="alarm-card-detail">{banner.detail}</div>
						</button>
					{:else}
						<article class="alarm-card" class:is-warn={banner.level === 'warn'}>
							<div class="alarm-card-head">
								<div class="alarm-card-title-wrap">
									<span class="status-dot" class:is-warn={banner.level === 'warn'}></span>
									<span class="alarm-card-title">{banner.title}</span>
								</div>
							</div>
							<div class="alarm-card-preview">{banner.preview}</div>
							<div class="alarm-card-detail">{banner.detail}</div>
						</article>
					{/if}
				{/each}
			</div>
		</section>
	{/if}
{/if}
