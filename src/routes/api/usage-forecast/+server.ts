import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isServiceError } from '$lib/server/services/errors';
import { getUsageForecast } from '$lib/server/services/forecast';

export const GET: RequestHandler = async ({ url }) => {
	try {
		return json(
			await getUsageForecast({
				hospitalId: url.searchParams.get('hospitalId') ?? 'HOSP0001',
				drugId: url.searchParams.get('drugId'),
				start: url.searchParams.get('start'),
				end: url.searchParams.get('end'),
				actualEnd: url.searchParams.get('actualEnd')
			})
		);
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
