import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { DEFAULT_OPENAI_MODEL_ID, OPENAI_MODEL_PRESETS } from '$lib/openai/models';
import { isServiceError } from '$lib/server/services/errors';
import {
	getUserDefaultModelId,
	setUserDefaultModelId
} from '$lib/server/services/user-preferences';

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user?.id ?? 'HOSP0001';

	try {
		return json({
			models: OPENAI_MODEL_PRESETS,
			defaultModelId: await getUserDefaultModelId(userId),
			fallbackDefaultModelId: DEFAULT_OPENAI_MODEL_ID
		});
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = locals.user?.id ?? 'HOSP0001';
	const payload = await request.json().catch(() => null);

	try {
		return json(
			await setUserDefaultModelId(userId, (payload as { modelId?: unknown })?.modelId)
		);
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
