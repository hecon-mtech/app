import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isServiceError } from '$lib/server/services/errors';
import { sendChatMessage } from '$lib/server/services/messages';

export const POST: RequestHandler = async ({ locals, request }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	const payload = await request.json().catch(() => null);

	try {
		return json(await sendChatMessage(hospitalId, payload));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
