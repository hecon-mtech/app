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

	const readErrorMessage = async (response: Response, fallback: string) => {
		const payload = await response.json().catch(() => ({}));
		return typeof payload?.message === 'string' ? payload.message : fallback;
	};

	const nextPath = () => page.url.searchParams.get('next') || '/hospital/chat';

	const formatUpdatedAt = (value: string) => {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '저장 이력 없음';
		return date.toLocaleString('ko-KR');
	};

	let credentials: CredentialSummary[] = [];
	let loading = true;
	let selectingId: number | null = null;
	let feedback = '';

	const chooseCredential = async (credentialId: number) => {
		if (selectingId === credentialId) return;
		selectingId = credentialId;
		feedback = '';

		try {
			const response = await fetch('/api/openai/credentials/select', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ credentialId })
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI 자격증명을 선택하지 못했습니다.'));
			}

			await goto(nextPath());
		} catch (error) {
			feedback = error instanceof Error ? error.message : 'OpenAI 자격증명을 선택하지 못했습니다.';
		} finally {
			selectingId = null;
		}
	};

	const loadCredentials = async () => {
		loading = true;
		feedback = '';

		try {
			const response = await fetch('/api/openai/credentials');
			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI 자격증명을 불러오지 못했습니다.'));
			}

			const payload = await response.json();
			credentials = Array.isArray(payload?.credentials) ? payload.credentials : [];

			if (credentials.length === 0) {
				await goto(`/hospital/openai/connect?next=${encodeURIComponent(nextPath())}`);
				return;
			}

			if (credentials.length === 1) {
				await chooseCredential(credentials[0].id);
			}
		} catch (error) {
			feedback = error instanceof Error ? error.message : 'OpenAI 자격증명을 불러오지 못했습니다.';
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		void loadCredentials();
	});
</script>

<section class="card select-card">
	<div class="select-card-header">
		<div>
			<h2>OpenAI 자격증명 선택</h2>
			<p class="muted">저장된 OAuth/API Key 자격증명 중 현재 대화에 사용할 계정을 선택하세요.</p>
		</div>
		<a class="button" href={`/hospital/openai/connect?next=${encodeURIComponent(nextPath())}`}>새 계정 연결</a>
	</div>

	{#if loading}
		<p class="muted">자격증명을 불러오는 중...</p>
	{:else}
		<div class="select-credential-list">
			{#each credentials as credential (credential.id)}
				<article class="select-credential-item">
					<div class="select-credential-copy">
						<h3>{credential.name}</h3>
						<p class="muted">
							{credential.kind === 'oauth'
								? 'OAuth 자격증명'
								: `API Key ${credential.apiKeyPreview ?? ''}`}
						</p>
						<p class="muted">최근 저장 {formatUpdatedAt(credential.updatedAt)}</p>
					</div>
					<button class="button" type="button" on:click={() => chooseCredential(credential.id)} disabled={selectingId === credential.id}>
						{selectingId === credential.id ? '선택 중...' : '이 계정 사용'}
					</button>
				</article>
			{/each}
		</div>
	{/if}

	{#if feedback}
		<p class="select-feedback">{feedback}</p>
	{/if}
</section>

<style>
	.select-card {
		display: grid;
		gap: 18px;
	}

	.select-card-header,
	.select-credential-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.select-card-header h2,
	.select-credential-copy h3,
	.select-feedback {
		margin: 0;
	}

	.select-credential-list {
		display: grid;
		gap: 12px;
	}

	.select-credential-item {
		padding: 16px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.58);
	}

	.select-credential-copy {
		display: grid;
		gap: 6px;
	}

	.select-feedback {
		color: #c0392b;
	}

	@media (max-width: 720px) {
		.select-card-header,
		.select-credential-item {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
