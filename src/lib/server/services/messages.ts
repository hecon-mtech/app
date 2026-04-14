import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { messages, messageSessions, sessionSummaries } from '$lib/server/db/schema/messaging';
import { openAiCredentials } from '$lib/server/db/schema/users';
import { getOpenAiModelPreset } from '$lib/openai/models';
import type { AssistantPayload } from '$lib/chat/render-blocks';
import { ServiceError } from './errors';
import { generateAssistantReply, generateConversationSummary } from '$lib/openai/agent/codex';
import { getOpenAiCredentialById } from '$lib/openai/agent/credentials';
import { getUserDefaultModelId } from './user-preferences';

const SUMMARIZATION_THRESHOLD = 10;

export type ChatSession = {
	id: number;
	title: string;
	createdAt: string;
	updatedAt: string;
	credentialId: number;
	credentialName: string;
	modelId: string;
	modelLabel: string;
};

export type ChatMessage = {
	id: number;
	role: 'user' | 'assistant';
	content: string;
	createdAt: string;
	payload?: AssistantPayload | null;
};

type PersistedTranscriptMessage = {
	role: 'user' | 'assistant';
	content: string;
	payload: unknown;
};

type SessionRow = {
	id: number;
	credentialId: number;
	credentialName: string;
	modelId: string;
	promptCacheKey: string;
	sessionName: string | null;
	createdAt: Date;
	updatedAt: Date;
};

const toSessionTitle = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}/${month}/${day} 대화기록`;
};

const toSession = (row: SessionRow): ChatSession => {
	const preset = getOpenAiModelPreset(row.modelId);
	return {
		id: row.id,
		title: row.sessionName?.trim() || toSessionTitle(row.createdAt),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		credentialId: row.credentialId,
		credentialName: row.credentialName,
		modelId: row.modelId,
		modelLabel: preset?.label ?? row.modelId
	};
};

const toMessage = (row: {
	id: number;
	entity: 'system' | 'user' | 'assistant';
	content: string;
	createdAt: Date;
	payload?: unknown;
}): ChatMessage => ({
	id: row.id,
	role: row.entity === 'user' ? 'user' : 'assistant',
	content: row.content,
	createdAt: row.createdAt.toISOString(),
	payload: row.payload && typeof row.payload === 'object' ? (row.payload as AssistantPayload) : null
});

const parseSessionId = (value: unknown) => {
	const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
	const sessionId = Number(normalized);
	if (!Number.isInteger(sessionId) || sessionId <= 0) {
		throw new ServiceError(400, 'sessionId is required.');
	}
	return sessionId;
};

const getOwnedSession = async (hospitalId: string, sessionId: number) => {
	const [session] = await drizzleDb
		.select({
			id: messageSessions.id,
			credentialId: messageSessions.credentialId,
			credentialName: openAiCredentials.name,
			modelId: messageSessions.modelId,
			promptCacheKey: messageSessions.promptCacheKey,
			sessionName: messageSessions.sessionName,
			createdAt: messageSessions.createdAt,
			updatedAt: messageSessions.updatedAt
		})
		.from(messageSessions)
		.innerJoin(openAiCredentials, eq(openAiCredentials.id, messageSessions.credentialId))
		.where(and(eq(messageSessions.id, sessionId), eq(messageSessions.hospitalId, hospitalId)))
		.limit(1);

	if (!session) {
		throw new ServiceError(404, '대화 세션을 찾을 수 없습니다.');
	}

	return session;
};

const getTranscript = async (sessionId: number) => {
	const rows = await drizzleDb
		.select({
			id: messages.id,
			entity: messages.entity,
			content: messages.content,
			createdAt: messages.createdAt,
			payload: messages.payload
		})
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(asc(messages.createdAt), asc(messages.id));

	return rows.map(toMessage);
};

const getTranscriptForProvider = async (sessionId: number) => {
	const [existing] = await drizzleDb
		.select({
			summary: sessionSummaries.summary,
			summarizedUpTo: sessionSummaries.summarizedUpTo
		})
		.from(sessionSummaries)
		.where(eq(sessionSummaries.sessionId, sessionId))
		.limit(1);

	const baseQuery = drizzleDb
		.select({
			entity: messages.entity,
			content: messages.content,
			payload: messages.payload
		})
		.from(messages)
		.where(
			existing
				? and(eq(messages.sessionId, sessionId), gt(messages.id, existing.summarizedUpTo))
				: eq(messages.sessionId, sessionId)
		)
		.orderBy(asc(messages.createdAt), asc(messages.id));

	const rows = await baseQuery;

	const transcript: PersistedTranscriptMessage[] = [];

	if (existing) {
		transcript.push({
			role: 'assistant',
			content: `[이전 대화 요약]\n${existing.summary}`,
			payload: null
		});
	}

	for (const row of rows) {
		if (row.entity !== 'user' && row.entity !== 'assistant') continue;
		transcript.push({
			role: row.entity,
			content: row.content,
			payload: row.payload
		});
	}

	return transcript;
};

export const listChatSessions = async (hospitalId: string) => {
	const rows = await drizzleDb
		.select({
			id: messageSessions.id,
			credentialId: messageSessions.credentialId,
			credentialName: openAiCredentials.name,
			modelId: messageSessions.modelId,
			promptCacheKey: messageSessions.promptCacheKey,
			sessionName: messageSessions.sessionName,
			createdAt: messageSessions.createdAt,
			updatedAt: messageSessions.updatedAt
		})
		.from(messageSessions)
		.innerJoin(openAiCredentials, eq(openAiCredentials.id, messageSessions.credentialId))
		.where(eq(messageSessions.hospitalId, hospitalId))
		.orderBy(desc(messageSessions.updatedAt), desc(messageSessions.id));

	return {
		sessions: rows.map(toSession)
	};
};

export const createChatSession = async (hospitalId: string, payload: unknown) => {
	const input = (payload ?? {}) as { credentialId?: unknown; modelId?: unknown };
	const credentialId = Number(input.credentialId);
	const requestedModelId = typeof input.modelId === 'string' ? input.modelId.trim() : '';

	if (!Number.isInteger(credentialId) || credentialId <= 0) {
		throw new ServiceError(400, 'credentialId is required.');
	}

	const modelId = requestedModelId || (await getUserDefaultModelId(hospitalId));

	if (!getOpenAiModelPreset(modelId)) {
		throw new ServiceError(400, '지원되지 않는 모델입니다.');
	}

	const credential = await getOpenAiCredentialById(hospitalId, credentialId);
	const now = new Date();
	const [session] = await drizzleDb
		.insert(messageSessions)
		.values({
			hospitalId,
			credentialId: credential.id,
			modelId,
			promptCacheKey: randomUUID(),
			sessionName: toSessionTitle(now),
			createdAt: now,
			updatedAt: now
		})
		.returning({
			id: messageSessions.id,
			credentialId: messageSessions.credentialId,
			modelId: messageSessions.modelId,
			promptCacheKey: messageSessions.promptCacheKey,
			sessionName: messageSessions.sessionName,
			createdAt: messageSessions.createdAt,
			updatedAt: messageSessions.updatedAt
		});

	return {
		session: toSession({
			...session,
			credentialName: credential.name
		})
	};
};

export const getChatMessages = async (hospitalId: string, sessionIdValue: unknown) => {
	const sessionId = parseSessionId(sessionIdValue);
	const session = await getOwnedSession(hospitalId, sessionId);
	const transcript = await getTranscript(sessionId);

	return {
		session: toSession(session),
		messages: transcript
	};
};

export const deleteChatSession = async (hospitalId: string, sessionIdValue: unknown) => {
	const sessionId = parseSessionId(sessionIdValue);
	await getOwnedSession(hospitalId, sessionId);

	await drizzleDb.transaction(async (tx) => {
		await tx.delete(sessionSummaries).where(eq(sessionSummaries.sessionId, sessionId));
		await tx.delete(messages).where(eq(messages.sessionId, sessionId));
		await tx
			.delete(messageSessions)
			.where(and(eq(messageSessions.id, sessionId), eq(messageSessions.hospitalId, hospitalId)));
	});

	return {
		sessionId,
		message: '대화 세션이 삭제되었습니다.'
	};
};

const maybeSummarizeSession = async (
	sessionId: number,
	credentialId: number,
	userId: string,
	modelId: string,
	promptCacheKey: string
) => {
	const [existing] = await drizzleDb
		.select({
			id: sessionSummaries.id,
			summary: sessionSummaries.summary,
			summarizedUpTo: sessionSummaries.summarizedUpTo
		})
		.from(sessionSummaries)
		.where(eq(sessionSummaries.sessionId, sessionId))
		.limit(1);

	const unsummarizedCondition = existing
		? and(
				eq(messages.sessionId, sessionId),
				eq(messages.entity, 'assistant'),
				gt(messages.id, existing.summarizedUpTo)
			)
		: and(eq(messages.sessionId, sessionId), eq(messages.entity, 'assistant'));

	const [{ count }] = await drizzleDb
		.select({ count: sql<number>`count(*)::int` })
		.from(messages)
		.where(unsummarizedCondition);

	if (count < SUMMARIZATION_THRESHOLD) return;

	const recentRows = await drizzleDb
		.select({
			id: messages.id,
			entity: messages.entity,
			content: messages.content
		})
		.from(messages)
		.where(
			existing
				? and(eq(messages.sessionId, sessionId), gt(messages.id, existing.summarizedUpTo))
				: eq(messages.sessionId, sessionId)
		)
		.orderBy(asc(messages.createdAt), asc(messages.id));

	const recentMessages = recentRows
		.filter((r) => r.entity === 'user' || r.entity === 'assistant')
		.map((r) => ({ role: r.entity as 'user' | 'assistant', content: r.content }));

	const lastMessageId = recentRows[recentRows.length - 1]?.id;
	if (!lastMessageId) return;

	try {
		const summary = await generateConversationSummary({
			credentialId,
			userId,
			modelId,
			promptCacheKey,
			previousSummary: existing?.summary ?? null,
			recentMessages
		});

		const now = new Date();
		if (existing) {
			await drizzleDb
				.update(sessionSummaries)
				.set({ summary, summarizedUpTo: lastMessageId, updatedAt: now })
				.where(eq(sessionSummaries.id, existing.id));
		} else {
			await drizzleDb.insert(sessionSummaries).values({
				sessionId,
				summary,
				summarizedUpTo: lastMessageId,
				createdAt: now,
				updatedAt: now
			});
		}

		console.log(`[summary] session=${sessionId} summarizedUpTo=${lastMessageId}`);
	} catch (err) {
		console.error(`[summary] failed for session=${sessionId}:`, err);
	}
};

export const sendChatMessage = async (hospitalId: string, payload: unknown) => {
	const sessionId = parseSessionId((payload as { sessionId?: unknown })?.sessionId);
	const content =
		typeof (payload as { content?: unknown })?.content === 'string'
			? (payload as { content: string }).content.trim()
			: '';

	if (!content) {
		throw new ServiceError(400, 'content is required.');
	}

	const session = await getOwnedSession(hospitalId, sessionId);
	const transcript = [
		...(await getTranscriptForProvider(sessionId)),
		{
			role: 'user' as const,
			content,
			payload: null
		}
	];
	const assistant = await generateAssistantReply({
		userId: hospitalId,
		hospitalId,
		credentialId: session.credentialId,
		modelId: session.modelId,
		promptCacheKey: session.promptCacheKey,
		transcript
	});

	const userMessageTime = new Date();
	const assistantTime = new Date();

	await drizzleDb.transaction(async (tx) => {
		await tx.insert(messages).values({
			sessionId,
			entity: 'user',
			content,
			createdAt: userMessageTime,
			updatedAt: userMessageTime
		});

		await tx.insert(messages).values({
			sessionId,
			entity: 'assistant',
			content: assistant.content,
			payload: assistant.payload,
			createdAt: assistantTime,
			updatedAt: assistantTime
		});

		await tx
			.update(messageSessions)
			.set({ updatedAt: assistantTime })
			.where(eq(messageSessions.id, sessionId));
	});

	// Fire-and-forget: summarize if threshold reached
	maybeSummarizeSession(
		sessionId,
		session.credentialId,
		hospitalId,
		session.modelId,
		session.promptCacheKey
	).catch(() => {});

	const updatedSession = await getOwnedSession(hospitalId, sessionId);
	const updatedTranscript = await getTranscript(sessionId);

	return {
		session: toSession(updatedSession),
		messages: updatedTranscript
	};
};

export const appendAssistantMessageToSession = async ({
	hospitalId,
	sessionIdValue,
	content,
	payload = null
}: {
	hospitalId: string;
	sessionIdValue: unknown;
	content: string;
	payload?: AssistantPayload | null;
}) => {
	const sessionId = parseSessionId(sessionIdValue);
	const session = await getOwnedSession(hospitalId, sessionId);
	const createdAt = new Date();

	await drizzleDb.transaction(async (tx) => {
		await tx.insert(messages).values({
			sessionId,
			entity: 'assistant',
			content,
			payload,
			createdAt,
			updatedAt: createdAt
		});

		await tx
			.update(messageSessions)
			.set({ updatedAt: createdAt })
			.where(eq(messageSessions.id, sessionId));
	});

	const updatedSession = await getOwnedSession(hospitalId, session.id);
	const updatedTranscript = await getTranscript(session.id);

	return {
		session: toSession(updatedSession),
		messages: updatedTranscript
	};
};
