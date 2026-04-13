<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { DEFAULT_OPENAI_MODEL_ID, type OpenAiModelPreset } from '$lib/openai/models';

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

	const initialCredentialsState: CredentialState = {
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
		if (Number.isNaN(date.getTime())) return '-';
		return date.toLocaleString('ko-KR');
	};

	const getConnectHref = () =>
		`/hospital/openai/connect?next=${encodeURIComponent(page.url.pathname + page.url.search)}`;

	let credentialsState = initialCredentialsState;
	let credentialsLoading = false;
	let selectingCredentialId: number | null = null;
	let deletingCredentialId: number | null = null;
	let credentialsFeedback = '';

	let availableModels: OpenAiModelPreset[] = [];
	let selectedModelId = DEFAULT_OPENAI_MODEL_ID;
	let loadingModels = false;
	let savingModel = false;
	let modelFeedback = '';

	const loadCredentials = async () => {
		credentialsLoading = true;
		credentialsFeedback = '';

		try {
			const response = await fetch('/api/openai/credentials');
			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI 자격증명 상태를 불러오지 못했습니다.'));
			}

			const payload = await response.json();
			credentialsState = {
				credentials: Array.isArray(payload?.credentials) ? payload.credentials : [],
				selectedCredentialId:
					typeof payload?.selectedCredentialId === 'number' ? payload.selectedCredentialId : null,
				requiresSelection: Boolean(payload?.requiresSelection)
			};
		} catch (error) {
			credentialsFeedback =
				error instanceof Error ? error.message : 'OpenAI 자격증명 상태를 불러오지 못했습니다.';
		} finally {
			credentialsLoading = false;
		}
	};

	const selectCredential = async (credentialId: number) => {
		if (selectingCredentialId === credentialId) return;
		selectingCredentialId = credentialId;
		credentialsFeedback = '';

		try {
			const response = await fetch('/api/openai/credentials/select', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ credentialId })
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI 자격증명을 선택하지 못했습니다.'));
			}

			credentialsState = {
				...credentialsState,
				selectedCredentialId: credentialId,
				requiresSelection: false
			};
			credentialsFeedback = '기본 OpenAI 자격증명이 저장되었습니다.';
		} catch (error) {
			credentialsFeedback =
				error instanceof Error ? error.message : 'OpenAI 자격증명을 선택하지 못했습니다.';
		} finally {
			selectingCredentialId = null;
		}
	};

	const deleteCredential = async (credentialId: number) => {
		if (deletingCredentialId === credentialId) return;
		deletingCredentialId = credentialId;
		credentialsFeedback = '';

		try {
			const response = await fetch(
				`/api/openai/credentials?credentialId=${encodeURIComponent(String(credentialId))}`,
				{ method: 'DELETE' }
			);

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI 자격증명을 삭제하지 못했습니다.'));
			}

			await loadCredentials();
			credentialsFeedback = '자격증명이 삭제되었습니다.';
		} catch (error) {
			credentialsFeedback =
				error instanceof Error ? error.message : 'OpenAI 자격증명을 삭제하지 못했습니다.';
		} finally {
			deletingCredentialId = null;
		}
	};

	const loadModels = async () => {
		loadingModels = true;
		modelFeedback = '';

		try {
			const response = await fetch('/api/openai/models');
			if (!response.ok) {
				throw new Error(await readErrorMessage(response, '모델 설정을 불러오지 못했습니다.'));
			}

			const payload = await response.json();
			availableModels = Array.isArray(payload?.models) ? payload.models : [];
			selectedModelId =
				typeof payload?.defaultModelId === 'string' ? payload.defaultModelId : DEFAULT_OPENAI_MODEL_ID;
		} catch (error) {
			modelFeedback = error instanceof Error ? error.message : '모델 설정을 불러오지 못했습니다.';
		} finally {
			loadingModels = false;
		}
	};

	const saveModel = async () => {
		if (savingModel) return;
		savingModel = true;
		modelFeedback = '';

		try {
			const response = await fetch('/api/openai/models', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ modelId: selectedModelId })
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, '기본 모델을 저장하지 못했습니다.'));
			}

			modelFeedback = '기본 모델이 저장되었습니다.';
		} catch (error) {
			modelFeedback = error instanceof Error ? error.message : '기본 모델을 저장하지 못했습니다.';
		} finally {
			savingModel = false;
		}
	};

	onMount(() => {
		void loadCredentials();
		void loadModels();
	});
</script>

<section class="card settings-card">
	<div class="settings-card-header">
		<div>
			<h2>Settings</h2>
			<p class="muted">기본 자격증명과 기본 모델을 여기서 관리합니다.</p>
		</div>
	</div>
</section>

<section class="card settings-card">
	<div class="section-header">
		<div>
			<h3>OpenAI Credentials</h3>
			<p class="muted">저장된 OAuth 자격증명 중 현재 사용할 계정을 선택하세요.</p>
		</div>
		<a class="icon-button" href={getConnectHref()} aria-label="자격증명 추가" title="자격증명 추가">
			<span class="material-symbols-outlined">add</span>
		</a>
	</div>

	<div class="summary-row">
		<span class="pill">저장된 자격증명 {credentialsState.credentials.length}개</span>
		{#if credentialsState.requiresSelection}
			<span class="pill warn">선택 필요</span>
		{/if}
	</div>

	{#if credentialsLoading}
		<p class="muted">자격증명을 불러오는 중...</p>
	{:else if credentialsState.credentials.length === 0}
		<p class="muted empty-copy">저장된 자격증명이 없습니다. 우측 상단의 `+` 버튼으로 OAuth를 연결하세요.</p>
	{:else}
		<div class="settings-table-wrap">
			<table class="settings-table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Type</th>
						<th>Preview</th>
						<th>Updated</th>
						<th>Selected</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>
					{#each credentialsState.credentials as credential (credential.id)}
						<tr>
							<td>{credential.name}</td>
							<td>{credential.kind === 'oauth' ? 'OAuth' : 'API Key'}</td>
							<td>
								{credential.kind === 'api_key' && credential.apiKeyPreview
									? credential.apiKeyPreview
									: 'OAuth token bundle'}
							</td>
							<td>{formatUpdatedAt(credential.updatedAt)}</td>
							<td>
								{#if credential.id === credentialsState.selectedCredentialId}
									<span class="pill ok">Current</span>
								{:else}
									<span class="muted">-</span>
								{/if}
							</td>
							<td class="action-cell">
								<button
									type="button"
									class="button"
									on:click={() => selectCredential(credential.id)}
									disabled={
										credential.id === credentialsState.selectedCredentialId ||
										selectingCredentialId === credential.id
									}
								>
									{selectingCredentialId === credential.id ? '저장 중...' : 'Use'}
								</button>
								<button
									type="button"
									class="button danger-button"
									on:click={() => deleteCredential(credential.id)}
									disabled={deletingCredentialId === credential.id}
								>
									{deletingCredentialId === credential.id ? '삭제 중...' : 'Delete'}
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if credentialsFeedback}
		<p class="feedback-text">{credentialsFeedback}</p>
	{/if}
</section>

<section class="card settings-card">
	<div class="section-header">
		<div>
			<h3>Default Model</h3>
			<p class="muted">모든 새 대화에 적용할 기본 모델을 사용자 기준으로 저장합니다.</p>
		</div>
		{#if loadingModels}
			<span class="pill">불러오는 중...</span>
		{/if}
	</div>

	<div class="field">
		<label for="default-openai-model">새 대화 기본 모델</label>
		<select id="default-openai-model" bind:value={selectedModelId} disabled={loadingModels || savingModel}>
			{#each availableModels as model}
				<option value={model.id}>{model.label}</option>
			{/each}
		</select>
	</div>

	<div class="model-row">
		<p class="muted model-help">
			현재 선택: {availableModels.find((model) => model.id === selectedModelId)?.description ?? '기본 모델'}
		</p>
		<button class="button" type="button" on:click={saveModel} disabled={loadingModels || savingModel || availableModels.length === 0}>
			{savingModel ? '저장 중...' : '기본 모델 저장'}
		</button>
	</div>

	{#if modelFeedback}
		<p class="feedback-text">{modelFeedback}</p>
	{/if}
</section>

<style>
	.settings-card {
		display: grid;
		gap: 16px;
	}

	.settings-card + .settings-card {
		margin-top: 20px;
	}

	.settings-card-header h2,
	.settings-card-header p,
	.section-header h3,
	.section-header p,
	.feedback-text,
	.model-help,
	.empty-copy {
		margin: 0;
	}

	.section-header,
	.model-row,
	.summary-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.summary-row {
		justify-content: flex-start;
	}

	.icon-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.7);
		background: rgba(255, 255, 255, 0.8);
		color: var(--ink);
		text-decoration: none;
	}

	.settings-table-wrap {
		overflow-x: auto;
	}

	.settings-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 760px;
	}

	.settings-table th,
	.settings-table td {
		padding: 12px 14px;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
		text-align: left;
		vertical-align: middle;
	}

	.settings-table th {
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
		font-weight: 700;
	}

	.settings-table td {
		font-size: 0.92rem;
		color: var(--ink);
	}

	.pill.warn {
		color: #c57a00;
	}

	.pill.ok {
		color: #1b7f3c;
	}

	.feedback-text {
		color: var(--muted);
	}

	.action-cell {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.danger-button {
		color: #b64747;
		border-color: rgba(210, 88, 88, 0.35);
	}

	.danger-button:hover {
		background: rgba(210, 88, 88, 0.08);
	}

	@media (max-width: 720px) {
		.section-header,
		.model-row {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
