import { eq } from 'drizzle-orm';
import { DEFAULT_OPENAI_MODEL_ID, getOpenAiModelPreset } from '$lib/openai/models';
import { drizzleDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { ServiceError } from './errors';

const normalizeModelId = (modelId: unknown) => {
	const value = typeof modelId === 'string' ? modelId.trim() : '';
	return getOpenAiModelPreset(value)?.id ?? null;
};

export const getUserDefaultModelId = async (userId: string) => {
	const [user] = await drizzleDb
		.select({ defaultModelId: users.defaultModelId })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!user) {
		throw new ServiceError(404, '사용자를 찾을 수 없습니다.');
	}

	return normalizeModelId(user.defaultModelId) ?? DEFAULT_OPENAI_MODEL_ID;
};

export const setUserDefaultModelId = async (userId: string, modelIdValue: unknown) => {
	const modelId = normalizeModelId(modelIdValue);
	if (!modelId) {
		throw new ServiceError(400, '지원되지 않는 모델입니다.');
	}

	const updatedAt = new Date();
	const rows = await drizzleDb
		.update(users)
		.set({
			defaultModelId: modelId,
			updatedAt
		})
		.where(eq(users.id, userId))
		.returning({ id: users.id, defaultModelId: users.defaultModelId });

	if (rows.length === 0) {
		throw new ServiceError(404, '사용자를 찾을 수 없습니다.');
	}

	return {
		defaultModelId: modelId
	};
};
