import { getToday } from '$lib/server/today';

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const toDateStr = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

export const getCurrentDate = () => {
	const today = getToday();
	today.setHours(0, 0, 0, 0);

	const dayOfWeek = today.getDay();

	const weekStart = new Date(today);
	weekStart.setDate(today.getDate() - dayOfWeek);

	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6);

	const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
	const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

	return {
		today: toDateStr(today),
		dayOfWeek: DAY_NAMES[dayOfWeek],
		weekStart: toDateStr(weekStart),
		weekEnd: toDateStr(weekEnd),
		monthStart: toDateStr(monthStart),
		monthEnd: toDateStr(monthEnd)
	};
};
