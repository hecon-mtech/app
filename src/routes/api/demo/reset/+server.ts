import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { resetDemoData } from '$lib/server/services/demo';

export const POST: RequestHandler = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	return json(await resetDemoData(hospitalId));
};
