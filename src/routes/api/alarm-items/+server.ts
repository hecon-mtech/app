import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getAlarmItems } from '$lib/server/services/orders';

export const GET: RequestHandler = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	return json(await getAlarmItems(hospitalId));
};
