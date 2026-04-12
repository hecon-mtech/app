import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isServiceError } from '$lib/server/services/errors';
import { createAuctionOrder } from '$lib/server/services/orders';

export const POST: RequestHandler = async ({ locals, request }) => {
	const hospitalId = locals.user?.id;
	if (!hospitalId) {
		return json({ message: 'Unauthorized.' }, { status: 401 });
	}

	const payload = await request.json().catch(() => null);

	try {
		return json(await createAuctionOrder(hospitalId, payload));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
