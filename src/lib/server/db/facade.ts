import type { ActivityPoint, DashboardSummary, OrderItem } from './types';
import { getInventoryWarnings, getRecentOrders } from '../services/orders';

export type DatabaseFacade = {
	getDashboardSummary: (hospitalId?: string) => Promise<DashboardSummary>;
	getRecentOrders: (hospitalId?: string) => Promise<OrderItem[]>;
	getActivity: () => Promise<ActivityPoint[]>;
};

const mockSummary: DashboardSummary = {
	metrics: [
		{ label: '입원', value: '128', delta: '+5.4%', status: 'ok' },
		{ label: '평균 대기', value: '14분', delta: '-2분', status: 'ok' },
		{ label: '재고 소진 경보', value: '4', delta: '+1', status: 'warn' },
		{ label: '공급 적체', value: '11', delta: '-3', status: 'urgent' }
	],
	activity: [
		{ label: '06:00', value: 12 },
		{ label: '09:00', value: 30 },
		{ label: '12:00', value: 46 },
		{ label: '15:00', value: 38 },
		{ label: '18:00', value: 42 }
	],
	occupancy: {
		used: 412,
		total: 500
	},
	inventory: [
		{ item: '아목시실린 (J01CA)', value: '0개', status: 'urgent' },
		{ item: '세프트리악손 (J01DD)', value: '3개', status: 'warn' },
		{ item: '아세트아미노펜 (N02BE)', value: '54개', status: 'ok' }
	]
};

export const mockDb: DatabaseFacade = {
	getDashboardSummary: async (hospitalId = 'HOSP0001') => ({
		...mockSummary,
		inventory: await getInventoryWarnings(hospitalId)
	}),
	getRecentOrders: async (hospitalId = 'HOSP0001') => getRecentOrders(hospitalId),
	getActivity: async () => mockSummary.activity
};
