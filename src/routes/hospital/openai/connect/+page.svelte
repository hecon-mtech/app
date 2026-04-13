<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		OPENAI_OAUTH_AUTHORIZE_URL,
		OPENAI_OAUTH_CLIENT_ID,
		OPENAI_OAUTH_REDIRECT_URI,
		OPENAI_OAUTH_SCOPE
	} from '$lib/openai/constants';

	type PendingFlow = {
		state: string;
		codeVerifier: string;
		authorizeUrl: string;
	};

	const FLOW_STORAGE_KEY = 'openai-connect-flow';

	const readErrorMessage = async (response: Response, fallback: string) => {
		const payload = await response.json().catch(() => ({}));
		return typeof payload?.message === 'string' ? payload.message : fallback;
	};

	const toBase64Url = (bytes: Uint8Array) =>
		btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/g, '');

	const createRandomString = (length: number) => {
		const bytes = new Uint8Array(length);
		crypto.getRandomValues(bytes);
		return toBase64Url(bytes);
	};

	const createCodeChallenge = async (verifier: string) => {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
		return toBase64Url(new Uint8Array(digest));
	};

	const buildAuthorizeUrl = (state: string, codeChallenge: string) => {
		const url = new URL(OPENAI_OAUTH_AUTHORIZE_URL);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', OPENAI_OAUTH_CLIENT_ID);
		url.searchParams.set('redirect_uri', OPENAI_OAUTH_REDIRECT_URI);
		url.searchParams.set('scope', OPENAI_OAUTH_SCOPE);
		url.searchParams.set('code_challenge', codeChallenge);
		url.searchParams.set('code_challenge_method', 'S256');
		url.searchParams.set('state', state);
		url.searchParams.set('id_token_add_organizations', 'true');
		url.searchParams.set('codex_cli_simplified_flow', 'true');
		url.searchParams.set('originator', 'codex_cli_rs');
		return url.toString();
	};

	const persistFlow = (flow: PendingFlow) => {
		sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flow));
	};

	const restoreFlow = () => {
		const stored = sessionStorage.getItem(FLOW_STORAGE_KEY);
		if (!stored) return null;

		try {
			const parsed = JSON.parse(stored) as PendingFlow;
			if (!parsed?.state || !parsed?.codeVerifier || !parsed?.authorizeUrl) return null;
			return parsed;
		} catch {
			return null;
		}
	};

	let name = '';
	let pastedAuthorization = '';
	let pendingFlow: PendingFlow | null = null;
	let generating = false;
	let saving = false;
	let feedback: { tone: 'success' | 'error'; message: string } | null = null;

	const beginOauthFlow = async () => {
		if (generating) return;
		if (!name.trim()) {
			feedback = { tone: 'error', message: '자격증명 이름을 먼저 입력해주세요.' };
			return;
		}

		generating = true;
		feedback = null;

		try {
			const state = createRandomString(16);
			const codeVerifier = createRandomString(32);
			const codeChallenge = await createCodeChallenge(codeVerifier);
			pendingFlow = {
				state,
				codeVerifier,
				authorizeUrl: buildAuthorizeUrl(state, codeChallenge)
			};
			persistFlow(pendingFlow);
			window.open(pendingFlow.authorizeUrl, '_blank', 'noopener,noreferrer');
		} catch (error) {
			feedback = {
				tone: 'error',
				message: error instanceof Error ? error.message : 'OAuth 연결 URL을 생성하지 못했습니다.'
			};
		} finally {
			generating = false;
		}
	};

	const saveCredential = async () => {
		if (saving) return;
		if (!name.trim()) {
			feedback = { tone: 'error', message: '자격증명 이름을 입력해주세요.' };
			return;
		}
		if (!pendingFlow) {
			feedback = { tone: 'error', message: '먼저 OpenAI 로그인 흐름을 시작해주세요.' };
			return;
		}
		if (!pastedAuthorization.trim()) {
			feedback = { tone: 'error', message: '리다이렉트 URL 또는 code를 붙여넣어주세요.' };
			return;
		}

		saving = true;
		feedback = null;

		try {
			const response = await fetch('/api/openai/credentials/connect', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					authorizationInput: pastedAuthorization.trim(),
					codeVerifier: pendingFlow.codeVerifier,
					expectedState: pendingFlow.state
				})
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response, 'OpenAI OAuth 자격증명을 저장하지 못했습니다.'));
			}

			sessionStorage.removeItem(FLOW_STORAGE_KEY);
			feedback = { tone: 'success', message: 'OpenAI OAuth 자격증명이 저장되었습니다.' };
			await goto(page.url.searchParams.get('next') || '/hospital/chat');
		} catch (error) {
			feedback = {
				tone: 'error',
				message:
					error instanceof Error
						? error.message
						: 'OpenAI OAuth 자격증명을 저장하지 못했습니다.'
			};
		} finally {
			saving = false;
		}
	};

	if (typeof window !== 'undefined') {
		pendingFlow = restoreFlow();
	}
</script>

<section class="card oauth-card">
	<div class="oauth-card-header">
		<div>
			<h2>OpenAI OAuth 연결</h2>
			<p class="muted">
				Opencode 수동 연결 흐름처럼 브라우저에서 로그인한 뒤, 최종 redirect URL 또는 code를 붙여넣어 저장합니다.
			</p>
		</div>
		<a class="button" href={page.url.searchParams.get('next') || '/hospital/chat'}>취소</a>
	</div>

	<div class="field">
		<label for="oauth-name">자격증명 이름</label>
		<input id="oauth-name" type="text" bind:value={name} placeholder="예: 개인 ChatGPT Pro" />
	</div>

	<div class="oauth-step-card">
		<div class="oauth-step-header">
			<h3>1. OpenAI 로그인 열기</h3>
			<button class="button" type="button" on:click={beginOauthFlow} disabled={generating}>
				{generating ? '생성 중...' : 'OpenAI 로그인 열기'}
			</button>
		</div>
		<p class="muted">ChatGPT Plus/Pro 계정으로 로그인한 뒤, 실패하더라도 주소창의 최종 redirect URL을 복사해서 아래에 붙여넣으면 됩니다.</p>
		{#if pendingFlow}
			<div class="oauth-url-box">
				<label for="generated-oauth-url">생성된 로그인 URL</label>
				<textarea id="generated-oauth-url" readonly rows="5" value={pendingFlow.authorizeUrl}></textarea>
			</div>
		{/if}
	</div>

	<div class="oauth-step-card">
		<div class="oauth-step-header">
			<h3>2. Redirect URL 또는 code 붙여넣기</h3>
		</div>
		<p class="muted">
			예: <code>http://localhost:1455/auth/callback?code=...&amp;state=...</code>
		</p>
		<textarea
			rows="6"
			bind:value={pastedAuthorization}
			placeholder="전체 redirect URL, code#state, code=...&state=..., 또는 raw code를 붙여넣으세요."
		></textarea>
		<div class="oauth-actions">
			<button class="button" type="button" on:click={saveCredential} disabled={saving}>
				{saving ? '저장 중...' : 'OAuth 자격증명 저장'}
			</button>
		</div>
	</div>

	{#if feedback}
		<p class={`oauth-feedback ${feedback.tone}`}>{feedback.message}</p>
	{/if}
</section>

<style>
	.oauth-card {
		display: grid;
		gap: 18px;
	}

	.oauth-card-header,
	.oauth-step-header,
	.oauth-actions {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.oauth-card-header h2,
	.oauth-step-header h3,
	.oauth-feedback {
		margin: 0;
	}

	.oauth-step-card,
	.oauth-url-box {
		display: grid;
		gap: 12px;
		padding: 16px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.58);
	}

	.oauth-feedback.success {
		color: #1b7f3c;
	}

	.oauth-feedback.error {
		color: #c0392b;
	}

	@media (max-width: 720px) {
		.oauth-card-header,
		.oauth-step-header,
		.oauth-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
