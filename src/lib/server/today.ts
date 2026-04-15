import { env } from '$env/dynamic/private';

const TEST_DATE = '2024-11-24';

/** Canonical "today" — returns the test anchor in TEST_MODE, real date otherwise. */
export const getToday = (): Date => {
	if (env.TEST_MODE === 'true') return new Date(TEST_DATE);
	return new Date();
};

export const getTodayStr = (): string => {
	const d = getToday();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};
