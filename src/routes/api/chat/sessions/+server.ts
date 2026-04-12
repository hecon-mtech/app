import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { createChatSession, listChatSessions } from '$lib/server/services/messages';
import { isServiceError } from '$lib/server/services/errors';

export const GET: RequestHandler = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	return json(await listChatSessions(hospitalId));
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	const payload = await request.json().catch(() => null);

	try {
		return json(await createChatSession(hospitalId, payload));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
