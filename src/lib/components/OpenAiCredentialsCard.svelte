<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	type CredentialSummary = {
		id: number;
		name: string;
		kind: 'oauth' | 'api_key';
		apiKeyPreview: string | null;
		updatedAt: string;
	};

	type CredentialState = {
		credentials: CredentialSummary[];
		selectedCredentialId: number | null;
		requiresSelection: boolean;
	};

	type Feedback = {
		tone: 'success' | 'error';
		message: string;
	};

	const initialState: CredentialState = {
		credentials: [],
		selectedCredentialId: null,
		requiresSelection: false
	};

	const readErrorMessage = async (response: Response, fallback: string) => {
		const payload = await response.json().catch(() => ({}));
		return typeof payload?.message === 'string' ? payload.message : fallback;
	};

	const formatUpdatedAt = (value: string) => {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '저장 이력 없음';
		return date.toLocaleString('ko-KR');
	};

	const getConnectHref = () =>
		`/hospital/openai/connect?next=${encodeURIComponent(page.url.pathname + page.url.search)}`;

	const getSelectHref = () =>
		`/hospital/openai/select?next=${encodeURIComponent(page.url.pathname + page.url.search)}`;

	let state = initialState;
	let loading = false;
	let selectingCredentialId: number | null = null;
	let apiKeyName = '';
	let apiKeyValue = '';
	let savingApiKey = false;
	let feedback: Feedback | null = null;

	const loadState = async () => {
		loading = true;
		feedback = null;

		try {
			const response = await fetch('/api/openai/credentials');
			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI 자격증명 상태를 불러오지 못했습니다.'));
			}

			const payload = await response.json();
			state = {
				credentials: Array.isArray(payload?.credentials) ? payload.credentials : [],
				selectedCredentialId:
					typeof payload?.selectedCredentialId === 'number' ? payload.selectedCredentialId : null,
				requiresSelection: Boolean(payload?.requiresSelection)
			};
		} catch (error) {
			feedback = {
				tone: 'error',
				message: error instanceof Error ? error.message : 'OpenAI 자격증명 상태를 불러오지 못했습니다.'
			};
		} finally {
			loading = false;
		}
	};

	const selectCredential = async (credentialId: number) => {
		if (selectingCredentialId === credentialId) return;
		selectingCredentialId = credentialId;
		feedback = null;

		try {
			const response = await fetch('/api/openai/credentials/select', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ credentialId })
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI 자격증명을 선택하지 못했습니다.'));
			}

			state = { ...state, selectedCredentialId: credentialId, requiresSelection: false };
			feedback = { tone: 'success', message: '기본 OpenAI 자격증명이 선택되었습니다.' };
		} catch (error) {
			feedback = {
				tone: 'error',
				message: error instanceof Error ? error.message : 'OpenAI 자격증명을 선택하지 못했습니다.'
			};
		} finally {
			selectingCredentialId = null;
		}
	};

	const saveApiKey = async () => {
		if (savingApiKey) return;
		const name = apiKeyName.trim();
		const apiKey = apiKeyValue.trim();

		if (!name) {
			feedback = { tone: 'error', message: 'API Key 자격증명 이름을 입력해주세요.' };
			return;
		}

		if (!apiKey) {
			feedback = { tone: 'error', message: 'API Key를 입력해주세요.' };
			return;
		}

		savingApiKey = true;
		feedback = null;

		try {
			const response = await fetch('/api/openai/credentials', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name, apiKey })
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'API Key 자격증명을 저장하지 못했습니다.'));
			}

			const payload = await response.json();
			const created = payload?.credential as CredentialSummary | undefined;
			if (created) {
				state = {
					...state,
					credentials: [created, ...state.credentials.filter((item) => item.id !== created.id)]
				};
			}
			apiKeyName = '';
			apiKeyValue = '';
			feedback = { tone: 'success', message: 'API Key 자격증명이 저장되었습니다.' };
		} catch (error) {
			feedback = {
				tone: 'error',
				message: error instanceof Error ? error.message : 'API Key 자격증명을 저장하지 못했습니다.'
			};
		} finally {
			savingApiKey = false;
		}
	};

	onMount(() => {
		void loadState();
	});
</script>

<section class="card openai-card">
	<div class="openai-card-header">
		<div>
			<h3>OpenAI 자격증명</h3>
			<p class="muted openai-card-copy">
				여러 OpenAI OAuth 계정을 저장하고, 현재 대화에 사용할 기본 자격증명을 선택할 수 있습니다.
			</p>
		</div>
		{#if loading}
			<span class="pill">불러오는 중...</span>
		{/if}
	</div>

	<div class="openai-summary-row">
		<div class="openai-summary-pill">저장된 자격증명 {state.credentials.length}개</div>
		{#if state.requiresSelection}
			<div class="openai-summary-pill warn">선택 필요</div>
		{/if}
	</div>

	{#if state.credentials.length > 0}
		<div class="openai-credential-list">
			{#each state.credentials as credential (credential.id)}
				<article class="openai-credential-item">
					<div class="openai-credential-copy">
						<div class="openai-credential-title-row">
							<h4>{credential.name}</h4>
							<span class={`openai-kind ${credential.kind === 'oauth' ? 'oauth' : 'api-key'}`}>
								{credential.kind === 'oauth' ? 'OAuth' : 'API Key'}
							</span>
							{#if credential.id === state.selectedCredentialId}
								<span class="openai-selected-pill">현재 선택됨</span>
							{/if}
						</div>
						<p class="muted openai-credential-meta">
							{credential.kind === 'api_key' && credential.apiKeyPreview
								? `저장된 키 ${credential.apiKeyPreview}`
								: 'OAuth 토큰 번들 저장됨'}
						</p>
						<p class="muted openai-credential-meta">최근 저장 {formatUpdatedAt(credential.updatedAt)}</p>
					</div>
					<div class="openai-credential-actions">
						<button
							type="button"
							class="button"
							on:click={() => selectCredential(credential.id)}
							disabled={credential.id === state.selectedCredentialId || selectingCredentialId === credential.id}
						>
							{selectingCredentialId === credential.id ? '선택 중...' : '이 계정 사용'}
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<div class="openai-actions-row">
		<a class="button" href={getConnectHref()}>OAuth 연결 페이지 열기</a>
		{#if state.credentials.length > 1}
			<a class="button" href={getSelectHref()}>선택 페이지 열기</a>
		{/if}
	</div>

	<form class="openai-form" on:submit|preventDefault={saveApiKey}>
		<h4>API Key 자격증명 추가</h4>
		<div class="grid-2 openai-form-grid">
			<div class="field">
				<label for="openai-api-name">자격증명 이름</label>
				<input id="openai-api-name" type="text" bind:value={apiKeyName} placeholder="예: 운영용 API Key" />
			</div>
			<div class="field">
				<label for="openai-api-key">OpenAI API Key</label>
				<input id="openai-api-key" type="password" bind:value={apiKeyValue} autocomplete="off" placeholder="sk-..." />
			</div>
		</div>
		<div class="openai-form-actions">
			<p class="muted openai-hint">OAuth 대신 표준 OpenAI API Key를 별도 자격증명으로 추가할 수 있습니다.</p>
			<button class="button" type="submit" disabled={savingApiKey || !apiKeyName.trim() || !apiKeyValue.trim()}>
				{savingApiKey ? '저장 중...' : 'API Key 자격증명 저장'}
			</button>
		</div>
	</form>

	{#if feedback}
		<p class={`openai-feedback ${feedback.tone}`}>{feedback.message}</p>
	{/if}
</section>

<style>
	.openai-card {
		margin-top: 20px;
		display: grid;
		gap: 18px;
	}

	.openai-card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.openai-card-copy {
		margin: 0;
		max-width: 720px;
		line-height: 1.5;
	}

	.openai-summary-row,
	.openai-actions-row,
	.openai-form-actions,
	.openai-credential-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.openai-summary-pill,
	.openai-selected-pill,
	.openai-kind {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.48);
		border: 1px solid rgba(255, 255, 255, 0.6);
	}

	.openai-summary-pill.warn {
		color: #c57a00;
	}

	.openai-kind.oauth,
	.openai-selected-pill {
		color: #1b7f3c;
	}

	.openai-kind.api-key {
		color: #275f96;
	}

	.openai-credential-list {
		display: grid;
		gap: 12px;
	}

	.openai-credential-item,
	.openai-form {
		display: grid;
		gap: 12px;
		padding: 16px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.44);
		border: 1px solid rgba(255, 255, 255, 0.58);
	}

	.openai-credential-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.openai-credential-title-row h4,
	.openai-form h4 {
		margin: 0;
	}

	.openai-credential-item {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
	}

	.openai-credential-copy {
		display: grid;
		gap: 6px;
	}

	.openai-credential-meta,
	.openai-feedback,
	.openai-hint {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.openai-feedback.success {
		color: #1b7f3c;
	}

	.openai-feedback.error {
		color: #c0392b;
	}

	.openai-form-grid {
		gap: 12px;
	}

	@media (max-width: 900px) {
		.openai-credential-item {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.openai-card-header,
		.openai-summary-row,
		.openai-actions-row,
		.openai-form-actions,
		.openai-credential-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
