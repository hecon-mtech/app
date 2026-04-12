import type { PageServerLoad } from './$types';
import { getAuctionOrdersPageData } from '$lib/server/services/orders';

export const load: PageServerLoad = async ({ locals, url }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	return getAuctionOrdersPageData(hospitalId, url.searchParams.get('range'));
};
