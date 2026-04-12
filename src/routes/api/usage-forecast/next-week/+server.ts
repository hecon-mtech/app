import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isServiceError } from '$lib/server/services/errors';
import { refreshNextWeekPrediction } from '$lib/server/services/forecast';

export const POST: RequestHandler = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';

	try {
		return json(await refreshNextWeekPrediction(hospitalId));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
