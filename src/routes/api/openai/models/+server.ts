import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { DEFAULT_OPENAI_MODEL_ID, OPENAI_MODEL_PRESETS } from '$lib/openai/models';

export const GET: RequestHandler = async () =>
	json({
		models: OPENAI_MODEL_PRESETS,
		defaultModelId: DEFAULT_OPENAI_MODEL_ID
	});
