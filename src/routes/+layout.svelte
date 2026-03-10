<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { bannerItems, setBannerItems } from '$lib/stores/bannerItems';
	import { sidebarCollapsed, initSidebarStore } from '$lib/stores/sidebar';
	import { getTenantSegmentFromPath } from '$lib/tenant';

	const navItems = [
		{ label: '대시보드', path: '/dashboards', icon: 'dashboard' },
		{ label: '데이터 입력', path: '/data-input', icon: 'edit_note' },
		{ label: '주문', path: '/order', icon: 'shopping_cart' },
		{ label: '설정', path: '/settings', icon: 'settings' }
	];

	let { children } = $props();

	const getTenantBasePath = () => `/${getTenantSegmentFromPath(page.url.pathname)}`;

	const getNavHref = (path: string) => `${getTenantBasePath()}${path}`;

	const isActive = (href: string) => {
		const path = page.url.pathname;
		return path.startsWith(href);
	};

	const isLogin = () => page.url.pathname === '/login';

	const pollIntervalMs = 60_000;

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

	const handleBannerClick = async (banner: unknown) => {
		const orderLink = toOrderBannerLink(banner);
		if (orderLink.action !== 'open-order-modal' || !orderLink.targetDrugId) return;
		const url = new URL(`${getTenantBasePath()}/dashboards`, page.url.origin);
		url.searchParams.set('openOrderDrugId', orderLink.targetDrugId);
		if (orderLink.targetLabel) {
			url.searchParams.set('openOrderLabel', orderLink.targetLabel);
		}
		await goto(`${url.pathname}${url.search}`);
	};

	$effect(() => {
		if (!isLogin()) {
			refreshBannerItems();
		}
	});

	onMount(() => {
		initSidebarStore();
		const onBannerRefreshRequest = () => {
			refreshBannerItems();
		};
		window.addEventListener('banner-refresh-request', onBannerRefreshRequest);
		const interval = setInterval(refreshBannerItems, pollIntervalMs);
		return () => {
			clearInterval(interval);
			window.removeEventListener('banner-refresh-request', onBannerRefreshRequest);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
	/>
	<title>MTECH</title>
	<meta name="description" content="MTECH" />
</svelte:head>

{#if isLogin()}
	<main class="login-shell">
		{@render children()}
	</main>
{:else}
	<div class="app-shell" class:sidebar-collapsed={$sidebarCollapsed}>
		<aside class="sidebar glass">
			<div class="sidebar-header">
				<div class="brand">
					<img src="/company_logo.png" alt="MTECH" class="brand-logo" />
				</div>
				<button
					type="button"
					class="sidebar-toggle"
					onclick={() => sidebarCollapsed.toggle()}
					aria-label={$sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					<span class="material-symbols-outlined">
						{$sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
					</span>
				</button>
			</div>

			<nav class="nav">
				{#each navItems as item}
					<a href={getNavHref(item.path)} class:active={isActive(getNavHref(item.path))} title={item.label}>
						<span class="material-symbols-outlined nav-icon">{item.icon}</span>
						{#if !$sidebarCollapsed}
							<span class="nav-label">{item.label}</span>
						{/if}
					</a>
				{/each}
			</nav>

			{#if !$sidebarCollapsed}
				<div class="sidebar-footer">
					시스템 동기화 - Postgres / hecon
					<div class="muted" style="margin-top: 6px;">마지막 갱신: 2분 전</div>
				</div>

				<div class="sidebar-controls">
					<button type="button" class="sidebar-action">관리자</button>
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
			<header class="topbar glass">
				<div class="topbar-row">
					<DatePicker />
					<div class="status-banner-marquee" role="region" aria-label="실시간 경보 및 시스템 상태">
						<div class="status-banner-track">
							{#each [...$bannerItems, ...$bannerItems] as banner}
								{#if toOrderBannerLink(banner).action === 'open-order-modal'}
									<button
										type="button"
										class="status-banner status-banner-btn is-clickable"
										class:is-warn={banner.level === 'warn'}
										onclick={() => handleBannerClick(banner)}
									>
										<div class="status-banner-head">
											<span class="status-dot" class:is-warn={banner.level === 'warn'}></span>
											<span class="status-banner-title">{banner.title}</span>
										</div>
										<div class="status-banner-preview">{banner.preview}</div>
										<div class="status-banner-popover">{banner.detail}</div>
									</button>
								{:else}
									<article class="status-banner" class:is-warn={banner.level === 'warn'}>
										<div class="status-banner-head">
											<span class="status-dot" class:is-warn={banner.level === 'warn'}></span>
											<span class="status-banner-title">{banner.title}</span>
										</div>
										<div class="status-banner-preview">{banner.preview}</div>
										<div class="status-banner-popover">{banner.detail}</div>
									</article>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			</header>

			<main class="content">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
