<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { AssistantPayload } from '$lib/chat/render-blocks';
	import Modal from '$lib/components/Modal.svelte';
	import MarkdownMessage from '$lib/components/MarkdownMessage.svelte';
	import StructuredRenderBlocks from '$lib/components/StructuredRenderBlocks.svelte';
	import { DEFAULT_OPENAI_MODEL_ID, type OpenAiModelPreset } from '$lib/openai/models';
	import { onMount, tick } from 'svelte';
	import {
		dashboardConversation,
		selectDashboardConversationSession,
		setDashboardConversationEntries,
		setDashboardConversationLoading,
		setDashboardConversationSessions,
		upsertDashboardConversationSession,
		type DashboardConversationEntry,
		type DashboardConversationSession
	} from '$lib/stores/dashboardConversation';

	type ConversationMessage = {
		id: number;
		role: 'assistant' | 'user';
		title?: string;
		content: string;
		createdAt: string;
		payload?: AssistantPayload | null;
	};

	type AssociatedDrug = {
		drugCode: string;
		drugName: string;
		manufactor: string;
		atcCode: string;
	};

	type CredentialSummary = {
		id: number;
		name: string;
		kind: 'oauth' | 'api_key';
		apiKeyPreview: string | null;
		updatedAt: string;
	};

	const starterPrompts = [
		'이번주 재고 리스크를 요약해줘',
		'알림 버튼에서 어떤 조치를 먼저 봐야 해?',
		'주문 우선순위를 대화형으로 정리해줘'
	];

	const assistantTitle = 'MTECHnician';

	const getFallbackSessionTitle = (value: Date = new Date()) => {
		const year = value.getFullYear();
		const month = String(value.getMonth() + 1).padStart(2, '0');
		const day = String(value.getDate()).padStart(2, '0');
		return `${year}/${month}/${day} 대화기록`;
	};

	const readErrorMessage = async (response: Response, fallback: string) => {
		const payload = await response.json().catch(() => ({}));
		return typeof payload?.message === 'string' ? payload.message : fallback;
	};

	let messages: ConversationMessage[] = [];
	let activeSession: DashboardConversationSession | null = null;
	let sessionTitle = getFallbackSessionTitle();
	let isLoadingConversation = false;
	let isEmptyState = true;
	let composerValue = '';
	let assistantTyping = false;
	let sendingSessionId: number | null = null;
	let transcriptRef: HTMLDivElement | null = null;
	let chatError = '';
	let creatingSession = false;
	let transcriptRequestId = 0;
	let lastLoadedSessionId: number | null = null;
	let mounted = false;
	let openAiReady = false;
	let selectedCredentialId: number | null = null;
	let credentials: CredentialSummary[] = [];
	let availableModels: OpenAiModelPreset[] = [];
	let selectedModelId = DEFAULT_OPENAI_MODEL_ID;

	let orderModalOpen = false;
	let associatedLoading = false;
	let associatedError = '';
	let selectedOrderLabel = '';
	let associatedDrugs: AssociatedDrug[] = [];
	let orderQtyByDrug: Record<string, number> = {};
	let bulkOrdering = false;
	let bulkOrderMessage: { tone: 'success' | 'error'; message: string } | null = null;
	let lastQueryOpenKey = '';
	let lastQueryNewSessionKey = '';

	$: activeSession =
		$dashboardConversation.sessions.find(
			(session: DashboardConversationSession) => session.id === $dashboardConversation.activeSessionId
		) ?? null;
	$: messages = $dashboardConversation.entries.map(
		(entry: DashboardConversationEntry): ConversationMessage => ({
			id: entry.id,
			role: entry.role,
			title: entry.role === 'assistant' ? assistantTitle : undefined,
			content: entry.content,
			createdAt: entry.createdAt,
			payload: entry.payload ?? null
		})
	);
	$: sessionTitle = activeSession?.title ?? getFallbackSessionTitle();
	$: isLoadingConversation =
		$dashboardConversation.loadingSessions ||
		($dashboardConversation.loadingEntries && $dashboardConversation.activeSessionId !== null);
	$: assistantTyping =
		sendingSessionId !== null && $dashboardConversation.activeSessionId === sendingSessionId;
	$: isEmptyState = !isLoadingConversation && messages.length === 0 && !assistantTyping;

	$: {
		const activeSessionId = $dashboardConversation.activeSessionId;
		if (activeSessionId === null) {
			lastLoadedSessionId = null;
		} else if (mounted && activeSessionId !== lastLoadedSessionId) {
			lastLoadedSessionId = activeSessionId;
			void loadMessagesForSession(activeSessionId);
		}
	}

	const scrollTranscriptToBottom = async (behavior: ScrollBehavior = 'smooth') => {
		await tick();
		transcriptRef?.scrollTo({ top: transcriptRef.scrollHeight, behavior });
	};

	const normalizeConversationMessages = (items: unknown[]): DashboardConversationEntry[] => {
		const seen = new Set<number>();
		const normalized: DashboardConversationEntry[] = [];

		for (const item of items) {
			if (!item || typeof item !== 'object') continue;
			const entry = item as Partial<DashboardConversationEntry>;
			if (typeof entry.id !== 'number' || seen.has(entry.id)) continue;
			if (entry.role !== 'assistant' && entry.role !== 'user') continue;
			if (typeof entry.content !== 'string' || typeof entry.createdAt !== 'string') continue;
			seen.add(entry.id);
				normalized.push({
					id: entry.id,
					role: entry.role,
					content: entry.content,
					createdAt: entry.createdAt,
					payload:
						entry.payload && typeof entry.payload === 'object'
							? (entry.payload as AssistantPayload)
							: null
				});
		}

		return normalized;
	};

	const buildSetupHref = (path: string) =>
		`${path}?next=${encodeURIComponent(page.url.pathname + page.url.search)}`;

	const persistSelectedModel = (modelId: string) => {
		selectedModelId = modelId;
	};

	const saveDefaultModel = async (modelId: string) => {
		const response = await fetch('/api/openai/models', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ modelId })
		});

		if (!response.ok) {
			throw new Error(await readErrorMessage(response, '기본 모델을 저장하지 못했습니다.'));
		}
	};

	const selectCredentialSilently = async (credentialId: number) => {
		const response = await fetch('/api/openai/credentials/select', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ credentialId })
		});

		if (!response.ok) {
			throw new Error(await readErrorMessage(response, 'OpenAI 자격증명을 선택하지 못했습니다.'));
		}

		selectedCredentialId = credentialId;
	};

	const loadOpenAiContext = async () => {
		const credentialsResponse = await fetch('/api/openai/credentials');
		if (!credentialsResponse.ok) {
			throw new Error(await readErrorMessage(credentialsResponse, 'OpenAI 자격증명 상태를 확인하지 못했습니다.'));
		}

		const credentialsPayload = await credentialsResponse.json();
		credentials = Array.isArray(credentialsPayload?.credentials) ? credentialsPayload.credentials : [];
		selectedCredentialId =
			typeof credentialsPayload?.selectedCredentialId === 'number'
				? credentialsPayload.selectedCredentialId
				: null;

		if (credentials.length === 0) {
			await goto(buildSetupHref('/hospital/openai/connect'));
			return false;
		}

		if (credentials.length === 1 && selectedCredentialId === null) {
			await selectCredentialSilently(credentials[0].id);
		}

		if (credentials.length > 1 && selectedCredentialId === null) {
			await goto(buildSetupHref('/hospital/openai/select'));
			return false;
		}

		const modelsResponse = await fetch('/api/openai/models');
		if (!modelsResponse.ok) {
			throw new Error(await readErrorMessage(modelsResponse, 'OpenAI 모델 목록을 불러오지 못했습니다.'));
		}

		const modelsPayload = await modelsResponse.json();
		availableModels = Array.isArray(modelsPayload?.models) ? modelsPayload.models : [];
		const defaultModelId =
			typeof modelsPayload?.defaultModelId === 'string'
				? modelsPayload.defaultModelId
				: DEFAULT_OPENAI_MODEL_ID;
		const resolvedModelId =
			availableModels.find((model) => model.id === defaultModelId)?.id ??
			availableModels[0]?.id ??
			DEFAULT_OPENAI_MODEL_ID;
		persistSelectedModel(resolvedModelId);
		openAiReady = true;
		return true;
	};

	const createConversationSession = async () => {
		if (creatingSession) return null;
		if (!openAiReady || selectedCredentialId === null) {
			chatError = 'OpenAI 자격증명을 먼저 선택해주세요.';
			return null;
		}
		creatingSession = true;
		chatError = '';

		try {
			const response = await fetch('/api/chat/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ credentialId: selectedCredentialId, modelId: selectedModelId })
			});
			if (!response.ok) {
				throw new Error(await readErrorMessage(response, '새 대화를 생성하지 못했습니다.'));
			}

			const payload = await response.json();
			if (!payload?.session || typeof payload.session.id !== 'number') {
				throw new Error('대화 세션 응답 형식이 올바르지 않습니다.');
			}

			upsertDashboardConversationSession(payload.session);
			selectDashboardConversationSession(payload.session.id);
			return payload.session.id as number;
		} catch (error) {
			chatError = error instanceof Error ? error.message : '새 대화를 생성하지 못했습니다.';
			return null;
		} finally {
			creatingSession = false;
		}
	};

	const initializeConversation = async () => {
		setDashboardConversationLoading('sessions', true);
		chatError = '';
		openAiReady = false;

		try {
			const ready = await loadOpenAiContext();
			if (!ready) {
				return;
			}

			const response = await fetch('/api/chat/sessions');
			if (!response.ok) {
				throw new Error(await readErrorMessage(response, '대화 세션을 불러오지 못했습니다.'));
			}

			const payload = await response.json();
			const sessions: DashboardConversationSession[] = Array.isArray(payload?.sessions)
				? payload.sessions
				: [];
			setDashboardConversationSessions(sessions);

			const existingActiveSessionId = $dashboardConversation.activeSessionId;
			const nextSessionId =
				sessions.find(
					(session: DashboardConversationSession) => session.id === existingActiveSessionId
				)?.id ?? sessions[0]?.id ?? null;

			if (nextSessionId !== null) {
				selectDashboardConversationSession(nextSessionId);
			} else {
				await createConversationSession();
			}
		} catch (error) {
			chatError = error instanceof Error ? error.message : '대화 세션을 불러오지 못했습니다.';
		} finally {
			setDashboardConversationLoading('sessions', false);
		}
	};

	const loadMessagesForSession = async (sessionId: number) => {
		const requestId = ++transcriptRequestId;
		setDashboardConversationLoading('entries', true);
		chatError = '';

		try {
			const response = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(String(sessionId))}`);
			if (!response.ok) {
				throw new Error(await readErrorMessage(response, '대화 내용을 불러오지 못했습니다.'));
			}

			const payload = await response.json();
			if (!mounted || requestId !== transcriptRequestId) return;

			if (payload?.session) {
				upsertDashboardConversationSession(payload.session);
			}

			setDashboardConversationEntries(
				Array.isArray(payload?.messages) ? normalizeConversationMessages(payload.messages) : []
			);
			await scrollTranscriptToBottom('auto');
		} catch (error) {
			if (!mounted || requestId !== transcriptRequestId) return;
			chatError = error instanceof Error ? error.message : '대화 내용을 불러오지 못했습니다.';
			setDashboardConversationEntries([]);
		} finally {
			if (mounted && requestId === transcriptRequestId) {
				setDashboardConversationLoading('entries', false);
			}
		}
	};

	const ensureActiveSessionId = async () => {
		if ($dashboardConversation.activeSessionId !== null) {
			return $dashboardConversation.activeSessionId;
		}

		return createConversationSession();
	};

	const sendMessage = async (text: string) => {
		const trimmed = text.trim();
		if (!trimmed || sendingSessionId !== null || !openAiReady) return;

		const sessionId = await ensureActiveSessionId();
		if (!sessionId) return;

		const previousEntries = $dashboardConversation.entries;
		const optimisticUserMessage: DashboardConversationEntry = {
			id: -Date.now(),
			role: 'user',
			content: trimmed,
			createdAt: new Date().toISOString()
		};

		setDashboardConversationEntries([...previousEntries, optimisticUserMessage]);
		composerValue = '';
		chatError = '';
		sendingSessionId = sessionId;
		const requestId = ++transcriptRequestId;
		await scrollTranscriptToBottom();

		try {
			const response = await fetch('/api/chat/send', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ sessionId, content: trimmed })
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, '대화 전송에 실패했습니다.'));
			}

			const payload = await response.json();
			if (payload?.session) {
				upsertDashboardConversationSession(payload.session);
			}

			if (
				mounted &&
				requestId === transcriptRequestId &&
				$dashboardConversation.activeSessionId === sessionId
			) {
				setDashboardConversationEntries(
					Array.isArray(payload?.messages)
						? normalizeConversationMessages(payload.messages)
						: previousEntries
				);
			}
		} catch (error) {
			if (
				mounted &&
				requestId === transcriptRequestId &&
				$dashboardConversation.activeSessionId === sessionId
			) {
				setDashboardConversationEntries(previousEntries);
				chatError = error instanceof Error ? error.message : '대화 전송에 실패했습니다.';
			}
		} finally {
			if (sendingSessionId === sessionId) {
				sendingSessionId = null;
			}

			if (
				mounted &&
				requestId === transcriptRequestId &&
				$dashboardConversation.activeSessionId === sessionId
			) {
				await scrollTranscriptToBottom();
			}
		}
	};

	const handlePromptClick = async (prompt: string) => {
		await sendMessage(prompt);
	};

	const handleComposerSubmit = async (event: SubmitEvent) => {
		event.preventDefault();
		await sendMessage(composerValue);
	};

	const handleComposerKeydown = async (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			await sendMessage(composerValue);
		}
	};

	const handleCreateSessionClick = async () => {
		if (sendingSessionId !== null || creatingSession) return;
		composerValue = '';
		await createConversationSession();
	};

	const handleModelChange = async (event: Event) => {
		const nextModelId = (event.currentTarget as HTMLSelectElement).value;
		const previousModelId = selectedModelId;
		persistSelectedModel(nextModelId);

		try {
			await saveDefaultModel(nextModelId);
		} catch (error) {
			persistSelectedModel(previousModelId);
			chatError = error instanceof Error ? error.message : '기본 모델을 저장하지 못했습니다.';
		}
	};

	const closeOrderModal = () => {
		orderModalOpen = false;
		associatedError = '';
		associatedDrugs = [];
		selectedOrderLabel = '';
		orderQtyByDrug = {};
		bulkOrdering = false;
		bulkOrderMessage = null;
	};

	const normalizeOrderQty = (value: number) => {
		if (!Number.isFinite(value) || value < 0) return 0;
		return Math.floor(value);
	};

	const getOrderQty = (drugCode: string) => orderQtyByDrug[drugCode] ?? 0;

	const handleOrderQtyInput = (drugCode: string, value: string) => {
		const next = normalizeOrderQty(Number(value));
		orderQtyByDrug = { ...orderQtyByDrug, [drugCode]: next };
	};

	const submitBulkOrder = async () => {
		if (bulkOrdering) return;
		const targets = associatedDrugs
			.map((drug) => ({ drugId: drug.drugCode, quantity: getOrderQty(drug.drugCode) }))
			.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);

		if (targets.length === 0) {
			bulkOrderMessage = { tone: 'error', message: '주문 개수가 1 이상인 약품이 없습니다.' };
			return;
		}

		bulkOrdering = true;
		bulkOrderMessage = null;

		try {
			for (const target of targets) {
				const response = await fetch('/api/auction-reg', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ drugId: target.drugId, quantity: target.quantity })
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(
						typeof payload?.message === 'string' ? payload.message : '주문 등록에 실패했습니다.'
					);
				}
			}

			bulkOrderMessage = {
				tone: 'success',
				message: `${targets.length}개 약품 주문이 등록되었습니다.`
			};
			if (typeof window !== 'undefined') {
				window.dispatchEvent(new Event('alarm-refresh-request'));
			}
		} catch (error) {
			bulkOrderMessage = {
				tone: 'error',
				message:
					error instanceof Error ? error.message : '주문 등록에 실패했습니다. 잠시 후 다시 시도하세요.'
			};
		} finally {
			bulkOrdering = false;
		}
	};

	const openOrderModalForDrug = async (drugId: string, label?: string) => {
		selectedOrderLabel = label && label.trim() ? label : drugId;
		orderModalOpen = true;
		associatedLoading = true;
		associatedError = '';
		associatedDrugs = [];
		orderQtyByDrug = {};
		bulkOrdering = false;
		bulkOrderMessage = null;

		if (!drugId) {
			associatedLoading = false;
			associatedError = '약품 식별자가 없어 연관 약품을 조회할 수 없습니다.';
			return;
		}

		try {
			const response = await fetch(`/api/drug-associations?drugId=${encodeURIComponent(drugId)}`);
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(
					typeof payload?.message === 'string'
						? payload.message
						: '연관 약품 조회에 실패했습니다.'
				);
			}
			associatedDrugs = Array.isArray(payload?.items) ? payload.items : [];
			orderQtyByDrug = Object.fromEntries(associatedDrugs.map((item) => [item.drugCode, 0]));
		} catch (error) {
			associatedError =
				error instanceof Error ? error.message : '연관 약품 조회에 실패했습니다. 잠시 후 다시 시도하세요.';
		} finally {
			associatedLoading = false;
		}
	};

	$: {
		const createSessionFlag = page.url.searchParams.get('newSession')?.trim() ?? '';
		if (!createSessionFlag) {
			lastQueryNewSessionKey = '';
		} else if (createSessionFlag !== lastQueryNewSessionKey && mounted) {
			lastQueryNewSessionKey = createSessionFlag;
			void handleCreateSessionClick();
			if (typeof window !== 'undefined') {
				const nextUrl = new URL(window.location.href);
				nextUrl.searchParams.delete('newSession');
				window.history.replaceState(window.history.state, '', nextUrl.toString());
			}
		}
	}

	$: {
		const drugId = page.url.searchParams.get('openOrderDrugId')?.trim() ?? '';
		if (!drugId) {
			lastQueryOpenKey = '';
		} else {
			const label = page.url.searchParams.get('openOrderLabel')?.trim() ?? '';
			const openKey = `${drugId}::${label}`;
			if (openKey !== lastQueryOpenKey) {
				lastQueryOpenKey = openKey;
				openOrderModalForDrug(drugId, label);
				if (typeof window !== 'undefined') {
					const nextUrl = new URL(window.location.href);
					nextUrl.searchParams.delete('openOrderDrugId');
					nextUrl.searchParams.delete('openOrderLabel');
					window.history.replaceState(window.history.state, '', nextUrl.toString());
				}
			}
		}
	}

	onMount(() => {
		mounted = true;
		const onSidebarNewSession = () => {
			void handleCreateSessionClick();
		};
		window.addEventListener('dashboard-new-session-request', onSidebarNewSession);
		void initializeConversation();
		return () => {
			window.removeEventListener('dashboard-new-session-request', onSidebarNewSession);
			mounted = false;
			transcriptRequestId += 1;
		};
	});
</script>

<div class="assistant-dashboard">
	<section class="card assistant-shell" class:is-empty={isEmptyState}>
		<header class="assistant-header">
			<div class="assistant-header-copy">
				<div class="assistant-eyebrow">{sessionTitle}</div>
				{#if activeSession}
					<div class="assistant-meta-row">
						<span class="assistant-meta-chip">OAuth: {activeSession.credentialName}</span>
						<span class="assistant-meta-chip">Model: {activeSession.modelLabel}</span>
					</div>
				{/if}
			</div>
			</header>

		{#if chatError}
			<p class="assistant-status-message error">{chatError}</p>
		{/if}

		<div class="assistant-stage" class:is-empty={isEmptyState}>
			{#if isLoadingConversation}
				<div class="assistant-loading-state">
					<p class="muted">대화기록을 불러오는 중...</p>
				</div>
			{:else if isEmptyState}
				<div class="assistant-empty-state">
					<form class="assistant-composer assistant-composer-empty" on:submit={handleComposerSubmit}>
						<textarea
							bind:value={composerValue}
							class="assistant-input"
							rows="1"
							placeholder="운영 질문을 입력하세요. 예: 이번주 재고 리스크를 우선순위대로 정리해줘"
							on:keydown={handleComposerKeydown}
						></textarea>
						<div class="assistant-composer-actions">
							<div class="assistant-composer-hint muted">Enter 전송, Shift+Enter 줄바꿈</div>
							<button type="submit" class="button" disabled={assistantTyping || !composerValue.trim()}>
								{assistantTyping ? '응답 작성 중...' : '전송'}
							</button>
						</div>
					</form>
				</div>
			{:else}
				<div class="assistant-transcript" bind:this={transcriptRef}>
					{#each messages as message (message.id)}
						<article class="assistant-message-row" class:is-user={message.role === 'user'}>
							<div class="assistant-avatar" class:is-user={message.role === 'user'}>
								{message.role === 'user' ? '나' : 'AI'}
							</div>
							<div class="assistant-bubble" class:is-user={message.role === 'user'}>
								{#if message.title}
									<div class="assistant-bubble-title">{message.title}</div>
								{/if}
								{#if message.role === 'assistant' && (message.payload?.toolTrace?.length ?? 0) > 0}
									<div class="tool-trace">
										<span class="tool-trace-label">사고 과정</span>
										<div class="tool-trace-step">질문자 의도 파악.</div>
										{#each message.payload?.toolTrace ?? [] as step}
											<div class="tool-trace-step">기능(Tool) 사용: {String((step).name ?? '')}</div>
										{/each}
									</div>
								{/if}
								<div class="assistant-bubble-content">
									{#if message.role === 'assistant' && (message.payload?.renderBlocks?.length ?? 0) > 0}
										<StructuredRenderBlocks blocks={message.payload?.renderBlocks ?? []} />
									{/if}
									<MarkdownMessage value={message.content} />
								</div>
							</div>
						</article>
					{/each}

					{#if assistantTyping}
						<article class="assistant-message-row">
							<div class="assistant-avatar">AI</div>
							<div class="assistant-bubble typing-bubble">
								<div class="assistant-bubble-title">MTECHnician</div>
								<div class="typing-dots" aria-label="응답 생성 중">
									<span></span>
									<span></span>
									<span></span>
								</div>
							</div>
						</article>
					{/if}
				</div>
			{/if}
		</div>

		<div class="assistant-chip-row">
			{#each starterPrompts as prompt}
				<button type="button" class="assistant-chip" on:click={() => handlePromptClick(prompt)}>
					{prompt}
				</button>
			{/each}
		</div>

		{#if !isEmptyState}
			<form class="assistant-composer" on:submit={handleComposerSubmit}>
				<textarea
					bind:value={composerValue}
					class="assistant-input"
					rows="1"
					placeholder="운영 질문을 입력하세요. 예: 이번주 재고 리스크를 우선순위대로 정리해줘"
					on:keydown={handleComposerKeydown}
				></textarea>
				<div class="assistant-composer-actions">
					<div class="assistant-composer-hint muted">Enter 전송, Shift+Enter 줄바꿈</div>
					<button type="submit" class="button" disabled={assistantTyping || !composerValue.trim()}>
						{assistantTyping ? '응답 작성 중...' : '전송'}
					</button>
				</div>
			</form>
		{/if}
	</section>
</div>

<Modal
	open={orderModalOpen}
	title={`${selectedOrderLabel} 연관 약품`}
	maxWidth="980px"
	on:close={closeOrderModal}
>
	{#if associatedLoading}
		<p class="muted">연관 약품을 조회하고 있습니다...</p>
	{:else if associatedError}
		<p class="modal-error">{associatedError}</p>
	{:else if associatedDrugs.length === 0}
		<p class="muted">연관 약품 데이터가 없습니다.</p>
	{:else}
		<div class="assoc-table-wrap">
			<table class="assoc-table">
				<thead>
					<tr>
						<th>약품 코드</th>
						<th>약품명</th>
						<th>제조사</th>
						<th>ATC 코드</th>
						<th>주문 개수</th>
					</tr>
				</thead>
				<tbody>
					{#each associatedDrugs as assoc}
						<tr>
							<td>{assoc.drugCode}</td>
							<td>{assoc.drugName}</td>
							<td>{assoc.manufactor}</td>
							<td>{assoc.atcCode}</td>
							<td>
								<input
									type="number"
									class="order-qty-input"
									min="0"
									step="1"
									value={getOrderQty(assoc.drugCode)}
									on:input={(event) =>
										handleOrderQtyInput(assoc.drugCode, (event.currentTarget as HTMLInputElement).value)}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if bulkOrderMessage?.message}
			<p class={`order-message ${bulkOrderMessage.tone === 'error' ? 'error' : 'success'}`}>
				{bulkOrderMessage.message}
			</p>
		{/if}
	{/if}
	<div slot="footer" class="modal-footer-actions">
		<button type="button" class="button order-submit-btn" on:click={submitBulkOrder} disabled={bulkOrdering}>
			{bulkOrdering ? '주문 중...' : '주문'}
		</button>
		<button type="button" class="button" on:click={closeOrderModal}>닫기</button>
	</div>
</Modal>

<style>
	.assistant-dashboard {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
	}

	.assistant-shell {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto;
		gap: 16px;
		width: 100%;
		height: 100%;
		min-height: 0;
		padding: 24px;
	}

	.assistant-shell.is-empty {
		grid-template-rows: auto minmax(0, 1fr) auto;
	}

	.assistant-header {
		display: block;
	}

	.assistant-header-copy,
	.assistant-title-row,
	.assistant-meta-row {
		display: flex;
		gap: 10px;
	}

	.assistant-header-copy {
		flex-direction: column;
		align-items: flex-start;
	}

	.assistant-title-row {
		align-items: center;
		flex-wrap: wrap;
	}

	.assistant-meta-row {
		flex-wrap: wrap;
	}

	.assistant-meta-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.62);
		color: rgba(31, 43, 58, 0.66);
	}

	.assistant-title {
		margin: 0;
		font-size: clamp(1.1rem, 1rem + 0.4vw, 1.45rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		color: rgba(31, 43, 58, 0.92);
	}

	.assistant-stage {
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.assistant-stage.is-empty {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.assistant-loading-state {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 0;
	}

	.assistant-status-message {
		margin: -4px 0 0;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.assistant-status-message.error {
		color: #c0392b;
	}

	.assistant-empty-state {
		width: min(760px, 100%);
		display: flex;
		justify-content: center;
	}

	.assistant-chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-start;
	}

	.assistant-shell.is-empty .assistant-chip-row {
		justify-content: center;
	}

	.assistant-chip {
		padding: 8px 12px;
		border: 1px solid rgba(255, 255, 255, 0.52);
		border-radius: 999px;
		background: transparent;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--ink);
		cursor: pointer;
		transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
	}

	.assistant-chip:hover {
		background: rgba(255, 255, 255, 0.36);
		border-color: rgba(255, 255, 255, 0.68);
		transform: translateY(-1px);
	}

	.assistant-transcript {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		gap: 18px;
		min-height: 0;
		overflow-y: auto;
		padding: 18px;
		padding-right: 4px;
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(240, 248, 255, 0.12)),
			radial-gradient(circle at top left, rgba(145, 212, 255, 0.18), transparent 34%);
		border: 1px solid rgba(255, 255, 255, 0.46);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
		scrollbar-width: thin;
		scrollbar-color: rgba(107, 122, 140, 0.34) transparent;
	}

	.assistant-message-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.assistant-message-row.is-user {
		flex-direction: row-reverse;
	}

	.assistant-avatar {
		flex: 0 0 auto;
		width: 34px;
		height: 34px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(209, 235, 255, 0.24));
		border: 1px solid rgba(255, 255, 255, 0.58);
		font-size: 0.76rem;
		font-weight: 700;
		color: #275f96;
	}

	.assistant-avatar.is-user {
		color: #1f2b3a;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.48), rgba(233, 239, 245, 0.2));
	}

	.assistant-bubble {
		max-width: min(1080px, 92%);
		padding: 14px 16px;
		border-radius: 18px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(244, 250, 255, 0.16));
		border: 1.5px solid rgba(31, 99, 181, 0.22);
		box-shadow:
			0 16px 36px rgba(31, 74, 121, 0.12),
			inset 0 1px 0 rgba(255, 255, 255, 0.8),
			inset 0 -1px 0 rgba(255, 255, 255, 0.14);
	}

	.assistant-bubble:not(.is-user) {
		max-width: min(1620px, 98%);
	}

	.assistant-bubble.is-user {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(223, 241, 255, 0.22));
	}

	.tool-trace {
		margin-bottom: 12px;
		padding: 10px 14px;
		border-radius: 12px;
		background: rgba(31, 43, 58, 0.03);
		border: 1px solid rgba(31, 43, 58, 0.06);
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.tool-trace-label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(31, 43, 58, 0.32);
		margin-bottom: 2px;
	}

	.tool-trace-step {
		font-size: 0.78rem;
		color: rgba(31, 43, 58, 0.36);
	}

	.assistant-bubble-title {
		margin-bottom: 8px;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(31, 43, 58, 0.52);
	}

	.assistant-bubble-content {
		display: grid;
		gap: 12px;
	}

	.assistant-bubble-content {
		display: grid;
		gap: 12px;
	}

	.assistant-visual-slot {
		display: none;
		min-height: 220px;
		border-radius: 16px;
		background: linear-gradient(180deg, rgba(229, 241, 255, 0.72), rgba(255, 255, 255, 0.38));
		border: 1px dashed rgba(30, 99, 181, 0.22);
	}

	.assistant-bubble :global(.markdown-message) {
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.assistant-bubble :global(.carta-viewer) {
		background: transparent;
		border: 0;
		padding: 0;
		font: inherit;
		color: inherit;
	}

	.assistant-bubble :global(.carta-viewer > *) {
		max-width: 100%;
	}

	.assistant-bubble :global(p),
	.assistant-bubble :global(ul),
	.assistant-bubble :global(ol),
	.assistant-bubble :global(pre),
	.assistant-bubble :global(blockquote),
	.assistant-bubble :global(table) {
		margin: 0 0 0.9rem;
	}

	.assistant-bubble :global(p:last-child),
	.assistant-bubble :global(ul:last-child),
	.assistant-bubble :global(ol:last-child),
	.assistant-bubble :global(pre:last-child),
	.assistant-bubble :global(blockquote:last-child),
	.assistant-bubble :global(table:last-child) {
		margin-bottom: 0;
	}

	.assistant-bubble :global(pre) {
		overflow-x: auto;
		padding: 12px 14px;
		border-radius: 14px;
		background: rgba(19, 28, 39, 0.9);
		color: #f5f8fb;
	}

	.assistant-bubble :global(code) {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 0.88em;
	}

	.assistant-bubble :global(:not(pre) > code) {
		padding: 0.14rem 0.38rem;
		border-radius: 8px;
		background: rgba(31, 43, 58, 0.08);
	}

	.assistant-bubble :global(a) {
		color: #1e63b5;
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.assistant-bubble :global(blockquote) {
		padding-left: 14px;
		border-left: 3px solid rgba(30, 99, 181, 0.28);
		color: rgba(31, 43, 58, 0.78);
	}

	.assistant-bubble :global(table) {
		display: block;
		width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
	}

	.assistant-bubble :global(th),
	.assistant-bubble :global(td) {
		padding: 8px 10px;
		border: 1px solid rgba(31, 43, 58, 0.12);
		text-align: left;
	}

	.assistant-bubble :global(h1),
	.assistant-bubble :global(h2),
	.assistant-bubble :global(h3),
	.assistant-bubble :global(h4) {
		margin: 0 0 0.7rem;
		line-height: 1.25;
	}

	.assistant-bubble :global(ul),
	.assistant-bubble :global(ol) {
		padding-left: 1.25rem;
	}

	.typing-bubble {
		width: 160px;
	}

	.typing-dots {
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}

	.typing-dots span {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: rgba(31, 43, 58, 0.46);
		animation: typing-dot 0.9s ease-in-out infinite;
	}

	.typing-dots span:nth-child(2) {
		animation-delay: 0.12s;
	}

	.typing-dots span:nth-child(3) {
		animation-delay: 0.24s;
	}

	.assistant-composer {
		display: grid;
		gap: 12px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.24);
	}

	.assistant-composer-empty {
		width: 100%;
		max-width: 760px;
		padding-top: 0;
		border-top: none;
	}

	.assistant-input {
		width: 100%;
		min-height: 92px;
		padding: 16px 18px;
		border: 1px solid rgba(255, 255, 255, 0.54);
		border-radius: 18px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.36), rgba(244, 250, 255, 0.18));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.8),
			inset 0 -1px 0 rgba(255, 255, 255, 0.14);
		font: inherit;
		font-size: 0.96rem;
		line-height: 1.55;
		color: var(--ink);
		resize: none;
		outline: none;
	}

	.assistant-input:focus {
		border-color: rgba(255, 255, 255, 0.7);
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.82),
			0 0 0 4px rgba(145, 212, 255, 0.24),
			inset 0 1px 0 rgba(255, 255, 255, 0.84);
	}

	.assistant-composer-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.assistant-composer-hint {
		font-size: 0.8rem;
	}

	.modal-error {
		margin: 0;
		color: #c0392b;
	}

	.assoc-table-wrap {
		overflow: auto;
	}

	.assoc-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.assoc-table th,
	.assoc-table td {
		padding: 8px 10px;
		border-bottom: 1px solid rgba(226, 232, 240, 0.9);
		text-align: left;
		vertical-align: top;
	}

	.order-qty-input {
		width: 88px;
		padding: 6px 8px;
		border: 1px solid rgba(148, 163, 184, 0.55);
		border-radius: 8px;
	}

	.order-submit-btn {
		background: linear-gradient(135deg, #ea6767, #d64545);
		color: #fff;
		box-shadow: 0 12px 24px rgba(214, 69, 69, 0.26);
	}

	.order-submit-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.modal-footer-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.order-message {
		margin: 6px 0 0;
		font-size: 0.78rem;
		line-height: 1.25;
	}

	.order-message.success {
		color: #1b7f3c;
	}

	.order-message.error {
		color: #c0392b;
	}

	@keyframes typing-dot {
		0%,
		80%,
		100% {
			opacity: 0.28;
			transform: translateY(0);
		}

		40% {
			opacity: 1;
			transform: translateY(-2px);
		}
	}

	@media (max-width: 980px) {
		.assistant-empty-state {
			width: 100%;
		}
	}

	@media (max-width: 720px) {
		.assistant-shell {
			padding: 18px;
			grid-template-rows: auto minmax(0, 1fr) auto auto;
		}

		.assistant-shell.is-empty {
			grid-template-rows: auto minmax(0, 1fr) auto;
		}

		.assistant-bubble {
			max-width: 100%;
		}

		.assistant-header {
			flex-direction: column;
			align-items: stretch;
		}

.assistant-composer-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.assistant-composer-hint {
			text-align: center;
		}
	}
</style>
