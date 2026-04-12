import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isServiceError } from '$lib/server/services/errors';
import { getChatMessages } from '$lib/server/services/messages';

export const GET: RequestHandler = async ({ locals, url }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';

	try {
		return json(await getChatMessages(hospitalId, url.searchParams.get('sessionId')));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
