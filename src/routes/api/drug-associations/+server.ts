import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getDrugAssociations } from '$lib/server/services/drugs';
import { isServiceError } from '$lib/server/services/errors';

export const GET: RequestHandler = async ({ url }) => {
	try {
		return json(await getDrugAssociations(url.searchParams.get('drugId')));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
