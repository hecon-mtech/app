import type { PageServerLoad } from './$types';
import { summarizeRecentPatients } from '$lib/server/services/patients';
import { suggestOrder, inventoryPrediction } from '$lib/server/services/inventory-summary';
import { getCurrentAuctionStatus } from '$lib/server/services/orders';
import { getToday, getTodayStr } from '$lib/server/today';

export const load: PageServerLoad = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';

	const anchor = getToday();
	const endDate = getTodayStr();
	const start = new Date(anchor);
	start.setDate(start.getDate() - 29);
	const startDate = toDateStr(start);

	const [patientSummary, orderSuggestions, auctionStatus] = await Promise.all([
		summarizeRecentPatients(hospitalId, startDate, endDate),
		suggestOrder(hospitalId),
		getCurrentAuctionStatus(hospitalId, null)
	]);

	const firstDrug = orderSuggestions.suggestions[0]?.drugCode ?? null;
	const initialForecast = firstDrug
		? await inventoryPrediction(hospitalId, firstDrug)
		: null;

	return { patientSummary, orderSuggestions, initialForecast, auctionStatus };
};

const toDateStr = (d: Date) => {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};
