import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isServiceError } from '$lib/server/services/errors';
import { getUsageForecastDrugOptions } from '$lib/server/services/forecast';

export const GET: RequestHandler = async ({ url }) => {
	try {
		return json(
			await getUsageForecastDrugOptions({
				hospitalId: url.searchParams.get('hospitalId') ?? 'HOSP0001',
				start: url.searchParams.get('start'),
				end: url.searchParams.get('end')
			})
		);
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
