import type { LayoutServerLoad } from './$types';
import { getTodayStr } from '$lib/server/today';

export const load: LayoutServerLoad = async () => {
	return { today: getTodayStr() };
};
