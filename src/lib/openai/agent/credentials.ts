import { and, eq } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { openAiCredentials } from '$lib/server/db/schema/users';
import {
	OPENAI_AUTH_JWT_CLAIM_PATH,
	OPENAI_OAUTH_CLIENT_ID,
	OPENAI_OAUTH_REDIRECT_URI,
	OPENAI_OAUTH_TOKEN_URL
} from '$lib/openai/constants';
import { ServiceError } from '$lib/server/services/errors';

export type StoredOpenAiOauth = {
	type: 'oauth';
	access: string;
	refresh: string;
	expires: number;
	accountId: string | null;
};

export type StoredOpenAiCredential = {
	id: number;
	userId: string;
	name: string;
	oauth: StoredOpenAiOauth | null;
	apiKey: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type OpenAiCredentialSummary = {
	id: number;
	name: string;
	kind: 'oauth' | 'api_key';
	apiKeyPreview: string | null;
	updatedAt: string;
};

export type OpenAiCredentialsState = {
	credentials: OpenAiCredentialSummary[];
	selectedCredentialId: number | null;
	requiresSelection: boolean;
};

type ParsedAuthInput = {
	code?: string;
	state?: string;
};

type ExchangeResult = {
	access: string;
	refresh: string;
	expires: number;
};

type CredentialRow = {
	id: number;
	userId: string;
	name: string;
	oauth: unknown;
	apiKey: string | null;
	createdAt: Date;
	updatedAt: Date;
};

const TOKEN_REFRESH_WINDOW_MS = 60_000;

const maskApiKey = (value: string | null) => {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length <= 8) return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
	return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
};

const parseCredentialId = (value: unknown) => {
	const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
	if (!normalized) return null;
	const credentialId = Number(normalized);
	return Number.isInteger(credentialId) && credentialId > 0 ? credentialId : null;
};

const decodeJwtPayload = (token: string) => {
	try {
		const [, payload] = token.split('.');
		if (!payload) return null;
		const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
		const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
		const decoded = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf-8')) as Record<string, unknown>;
		return decoded;
	} catch {
		return null;
	}
};

const extractAccountId = (accessToken: string) => {
	const payload = decodeJwtPayload(accessToken);
	const authBlock = payload?.[OPENAI_AUTH_JWT_CLAIM_PATH] as
		| { chatgpt_account_id?: unknown }
		| undefined;
	return typeof authBlock?.chatgpt_account_id === 'string' ? authBlock.chatgpt_account_id : null;
};

const parseAuthorizationInput = (input: string) => {
	const value = input.trim();
	if (!value) return {} as ParsedAuthInput;

	try {
		const url = new URL(value);
		return {
			code: url.searchParams.get('code') ?? undefined,
			state: url.searchParams.get('state') ?? undefined
		};
	} catch {
		// ignore URL parse failure and keep falling through
	}

	if (value.includes('#')) {
		const [code, state] = value.split('#', 2);
		return { code, state };
	}

	if (value.includes('code=')) {
		const params = new URLSearchParams(value);
		return {
			code: params.get('code') ?? undefined,
			state: params.get('state') ?? undefined
		};
	}

	return { code: value };
};

const normalizeOauthPayload = (value: unknown): StoredOpenAiOauth => {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new ServiceError(400, 'oauth payload is required.');
		}

		try {
			return normalizeOauthPayload(JSON.parse(trimmed));
		} catch {
			throw new ServiceError(400, 'oauth payload must be valid JSON.');
		}
	}

	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new ServiceError(400, 'oauth payload must be a JSON object.');
	}

	const input = value as Record<string, unknown>;
	const access =
		typeof input.access === 'string'
			? input.access.trim()
			: typeof input.access_token === 'string'
				? input.access_token.trim()
				: '';
	const refresh =
		typeof input.refresh === 'string'
			? input.refresh.trim()
			: typeof input.refresh_token === 'string'
				? input.refresh_token.trim()
				: '';
	const expires =
		typeof input.expires === 'number'
			? input.expires
			: typeof input.expires_at === 'number'
				? input.expires_at
				: typeof input.expires_in === 'number'
					? Date.now() + input.expires_in * 1000
					: NaN;

	if (!access || !refresh || !Number.isFinite(expires)) {
		throw new ServiceError(400, 'oauth payload is missing access, refresh, or expires information.');
	}

	return {
		type: 'oauth',
		access,
		refresh,
		expires,
		accountId:
			typeof input.accountId === 'string' ? input.accountId : extractAccountId(access)
	};
};

const toCredential = (row: CredentialRow): StoredOpenAiCredential => ({
	id: row.id,
	userId: row.userId,
	name: row.name,
	oauth: row.oauth ? normalizeOauthPayload(row.oauth) : null,
	apiKey: row.apiKey,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt
});

const toSummary = (row: StoredOpenAiCredential): OpenAiCredentialSummary => ({
	id: row.id,
	name: row.name,
	kind: row.oauth ? 'oauth' : 'api_key',
	apiKeyPreview: maskApiKey(row.apiKey),
	updatedAt: row.updatedAt.toISOString()
});

const listCredentialRows = async (userId: string) => {
	const rows = await drizzleDb
		.select({
			id: openAiCredentials.id,
			userId: openAiCredentials.userId,
			name: openAiCredentials.name,
			oauth: openAiCredentials.oauth,
			apiKey: openAiCredentials.apiKey,
			createdAt: openAiCredentials.createdAt,
			updatedAt: openAiCredentials.updatedAt
		})
		.from(openAiCredentials)
		.where(eq(openAiCredentials.userId, userId));

	return rows.map(toCredential);
};

const getCredentialById = async (userId: string, credentialId: number) => {
	const [row] = await drizzleDb
		.select({
			id: openAiCredentials.id,
			userId: openAiCredentials.userId,
			name: openAiCredentials.name,
			oauth: openAiCredentials.oauth,
			apiKey: openAiCredentials.apiKey,
			createdAt: openAiCredentials.createdAt,
			updatedAt: openAiCredentials.updatedAt
		})
		.from(openAiCredentials)
		.where(and(eq(openAiCredentials.userId, userId), eq(openAiCredentials.id, credentialId)))
		.limit(1);

	if (!row) {
		throw new ServiceError(404, 'OpenAI 자격증명을 찾을 수 없습니다.');
	}

	return toCredential(row);
};

const exchangeAuthorizationCode = async (code: string, codeVerifier: string): Promise<ExchangeResult> => {
	const response = await fetch(OPENAI_OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: OPENAI_OAUTH_CLIENT_ID,
			code,
			code_verifier: codeVerifier,
			redirect_uri: OPENAI_OAUTH_REDIRECT_URI
		})
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new ServiceError(400, errorText || 'OpenAI OAuth 코드 교환에 실패했습니다.');
	}

	const json = (await response.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	};

	if (
		typeof json.access_token !== 'string' ||
		typeof json.refresh_token !== 'string' ||
		typeof json.expires_in !== 'number'
	) {
		throw new ServiceError(400, 'OpenAI OAuth 토큰 응답 형식이 올바르지 않습니다.');
	}

	return {
		access: json.access_token,
		refresh: json.refresh_token,
		expires: Date.now() + json.expires_in * 1000
	};
};

const refreshAccessToken = async (refreshToken: string): Promise<ExchangeResult> => {
	const response = await fetch(OPENAI_OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: OPENAI_OAUTH_CLIENT_ID
		})
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new ServiceError(401, errorText || 'OpenAI 토큰 갱신에 실패했습니다.');
	}

	const json = (await response.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	};

	if (
		typeof json.access_token !== 'string' ||
		typeof json.refresh_token !== 'string' ||
		typeof json.expires_in !== 'number'
	) {
		throw new ServiceError(401, 'OpenAI 토큰 갱신 응답 형식이 올바르지 않습니다.');
	}

	return {
		access: json.access_token,
		refresh: json.refresh_token,
		expires: Date.now() + json.expires_in * 1000
	};
};

export const getOpenAiCredentialsState = async (
	userId: string,
	selectedCredentialIdValue?: unknown
): Promise<OpenAiCredentialsState> => {
	const credentials = await listCredentialRows(userId);
	const selectedCredentialId = parseCredentialId(selectedCredentialIdValue);
	const hasSelected =
		selectedCredentialId !== null && credentials.some((credential) => credential.id === selectedCredentialId);

	return {
		credentials: credentials.map(toSummary),
		selectedCredentialId: hasSelected
			? selectedCredentialId
			: credentials.length === 1
				? credentials[0].id
				: null,
		requiresSelection: credentials.length > 1 && !hasSelected
	};
};

export const createOpenAiCredential = async (userId: string, payload: unknown) => {
	const input = (payload ?? {}) as { name?: unknown; oauth?: unknown; apiKey?: unknown };
	const name = typeof input.name === 'string' ? input.name.trim() : '';

	if (!name) {
		throw new ServiceError(400, 'name is required.');
	}

	const oauth = 'oauth' in input ? normalizeOauthPayload(input.oauth) : null;
	const apiKey =
		'apiKey' in input
			? typeof input.apiKey === 'string' && input.apiKey.trim()
				? input.apiKey.trim()
				: (() => {
					throw new ServiceError(400, 'apiKey is required.');
				})()
			: null;

		if (!oauth && !apiKey) {
			throw new ServiceError(400, 'oauth or apiKey is required.');
		}

		const now = new Date();
		const [row] = await drizzleDb
			.insert(openAiCredentials)
			.values({
				userId,
				name,
				oauth,
				apiKey,
				createdAt: now,
				updatedAt: now
			})
			.returning({
				id: openAiCredentials.id,
				userId: openAiCredentials.userId,
				name: openAiCredentials.name,
				oauth: openAiCredentials.oauth,
				apiKey: openAiCredentials.apiKey,
				createdAt: openAiCredentials.createdAt,
				updatedAt: openAiCredentials.updatedAt
			});

		return {
			credential: toSummary(toCredential(row))
		};
};

export const connectOpenAiCredential = async (userId: string, payload: unknown) => {
	const input = (payload ?? {}) as {
		name?: unknown;
		authorizationInput?: unknown;
		codeVerifier?: unknown;
		expectedState?: unknown;
	};

	const name = typeof input.name === 'string' ? input.name.trim() : '';
	const authorizationInput =
		typeof input.authorizationInput === 'string' ? input.authorizationInput.trim() : '';
	const codeVerifier = typeof input.codeVerifier === 'string' ? input.codeVerifier.trim() : '';
	const expectedState = typeof input.expectedState === 'string' ? input.expectedState.trim() : '';

	if (!name) {
		throw new ServiceError(400, 'name is required.');
	}

	if (!authorizationInput) {
		throw new ServiceError(400, 'authorizationInput is required.');
	}

	if (!codeVerifier) {
		throw new ServiceError(400, 'codeVerifier is required.');
	}

	const parsed = parseAuthorizationInput(authorizationInput);
	if (!parsed.code) {
		throw new ServiceError(400, 'authorization code를 찾을 수 없습니다. 전체 redirect URL 또는 code를 입력해주세요.');
	}

	if (expectedState && parsed.state && parsed.state !== expectedState) {
		throw new ServiceError(400, 'OAuth state가 일치하지 않습니다. 새로 연결을 시작해주세요.');
	}

	const exchanged = await exchangeAuthorizationCode(parsed.code, codeVerifier);
	return createOpenAiCredential(userId, {
		name,
		oauth: {
			type: 'oauth',
			access: exchanged.access,
			refresh: exchanged.refresh,
			expires: exchanged.expires,
			accountId: extractAccountId(exchanged.access)
		}
	});
};

export const ensureSelectableOpenAiCredential = async (userId: string, credentialIdValue: unknown) => {
	const credentialId = parseCredentialId(credentialIdValue);
	if (credentialId === null) {
		throw new ServiceError(400, 'credentialId is required.');
	}

	const credential = await getCredentialById(userId, credentialId);
	return {
		credentialId: credential.id,
		credential: toSummary(credential)
	};
};

export const resolveSelectedOpenAiCredential = async (userId: string, selectedCredentialIdValue?: unknown) => {
	const credentials = await listCredentialRows(userId);
	if (credentials.length === 0) {
		throw new ServiceError(409, 'OpenAI 자격증명이 없습니다. 먼저 연결을 완료해주세요.');
	}

	const selectedCredentialId = parseCredentialId(selectedCredentialIdValue);
	if (selectedCredentialId !== null) {
		const selected = credentials.find((credential) => credential.id === selectedCredentialId);
		if (selected) {
			return selected;
		}
	}

	if (credentials.length === 1) {
		return credentials[0];
	}

	throw new ServiceError(409, 'OpenAI 자격증명을 선택해주세요.');
};

export const getOpenAiCredentialById = async (userId: string, credentialId: number) =>
	getCredentialById(userId, credentialId);

export const getUsableOpenAiCredential = async (userId: string, credentialId: number) => {
	const credential = await getCredentialById(userId, credentialId);

	if (!credential.oauth) {
		return credential;
	}

	if (credential.oauth.expires > Date.now() + TOKEN_REFRESH_WINDOW_MS) {
		return credential;
	}

	const refreshed = await refreshAccessToken(credential.oauth.refresh);
	const oauth: StoredOpenAiOauth = {
		type: 'oauth',
		access: refreshed.access,
		refresh: refreshed.refresh,
		expires: refreshed.expires,
		accountId: extractAccountId(refreshed.access)
	};

	const [row] = await drizzleDb
		.update(openAiCredentials)
		.set({ oauth, updatedAt: new Date() })
		.where(eq(openAiCredentials.id, credential.id))
		.returning({
			id: openAiCredentials.id,
			userId: openAiCredentials.userId,
			name: openAiCredentials.name,
			oauth: openAiCredentials.oauth,
			apiKey: openAiCredentials.apiKey,
			createdAt: openAiCredentials.createdAt,
			updatedAt: openAiCredentials.updatedAt
		});

	return toCredential(row);
};

export const deleteOpenAiCredential = async (userId: string, credentialIdValue: unknown) => {
	const credentialId = parseCredentialId(credentialIdValue);
	if (credentialId === null) {
		throw new ServiceError(400, 'credentialId is required.');
	}

	await getCredentialById(userId, credentialId);

	const { messages: messagesTable, messageSessions } = await import('$lib/server/db/schema/messaging');
	const sessions = await drizzleDb
		.select({ id: messageSessions.id })
		.from(messageSessions)
		.where(and(eq(messageSessions.hospitalId, userId), eq(messageSessions.credentialId, credentialId)));

	if (sessions.length > 0) {
		const sessionIds = sessions.map((s) => s.id);
		for (const sessionId of sessionIds) {
			await drizzleDb.delete(messagesTable).where(eq(messagesTable.sessionId, sessionId));
		}
		await drizzleDb
			.delete(messageSessions)
			.where(and(eq(messageSessions.hospitalId, userId), eq(messageSessions.credentialId, credentialId)));
	}

	await drizzleDb
		.delete(openAiCredentials)
		.where(and(eq(openAiCredentials.userId, userId), eq(openAiCredentials.id, credentialId)));

	return { credentialId };
};

export { parseCredentialId };
