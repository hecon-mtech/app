import type { ActivityPoint, DashboardSummary, OrderItem } from './types';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { drizzleDb } from './drizzle';
import {
	atcCodes,
	currentUsages,
	purchaseOrderItems,
	purchaseOrders,
	stockBalances
} from './schema';

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

const toNumber = (value: unknown) => Number(value ?? 0);
const formatQty = (value: number) => (Number.isInteger(value) ? `${value}` : value.toFixed(1));

const toDate = (value: unknown) => {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date;
};

const toDateLabel = (value: Date | null) => {
	if (!value) return '-';
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const getUsageWindowStart = async (hospitalId: string) => {
	const latestRows = await drizzleDb
		.select({ latest: sql<unknown>`max(${currentUsages.timestamp})` })
		.from(currentUsages)
		.where(eq(currentUsages.hospitalId, hospitalId));

	const latestUsageDate = toDate(latestRows[0]?.latest);
	const anchor = latestUsageDate ?? new Date();
	const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
	start.setMonth(start.getMonth() - 3);
	return start;
};

const getBalanceCandidates = async (hospitalId: string, drugIds?: string[]) => {
	const whereClause =
		drugIds && drugIds.length > 0
			? and(eq(stockBalances.hospitalId, hospitalId), inArray(stockBalances.drugId, drugIds))
			: eq(stockBalances.hospitalId, hospitalId);

	const balanceRows = await drizzleDb
		.select({
			drugId: stockBalances.drugId,
			onHand: stockBalances.onHand,
			reorderPoint: stockBalances.reorderPoint,
			drugName: atcCodes.name
		})
		.from(stockBalances)
		.innerJoin(atcCodes, eq(stockBalances.drugId, atcCodes.id))
		.where(whereClause);

	return balanceRows
		.map((row) => {
			const onHand = toNumber(row.onHand);
			const reorderPoint = toNumber(row.reorderPoint);
			return {
				drugId: row.drugId,
				drugName: row.drugName,
				onHand,
				status: onHand <= 0 ? 'urgent' : 'warn',
				shortage: reorderPoint - onHand,
				usage: 0
			};
		})
		.filter((row) => row.shortage >= 0)
		.sort((left, right) => left.onHand - right.onHand || right.shortage - left.shortage)
		.slice(0, 10);
};

const getStockoutCandidates = async (hospitalId: string) => {
	const since = await getUsageWindowStart(hospitalId);
	const usageRows = await drizzleDb
		.select({
			drugId: currentUsages.drugId,
			totalUsage: sql<string>`sum(${currentUsages.quantity})`
		})
		.from(currentUsages)
		.where(and(eq(currentUsages.hospitalId, hospitalId), gte(currentUsages.timestamp, since)))
		.groupBy(currentUsages.drugId);

	if (usageRows.length === 0) {
		return getBalanceCandidates(hospitalId);
	}

	const usageMap = new Map(usageRows.map((row) => [row.drugId, toNumber(row.totalUsage)]));
	const drugIds = usageRows.map((row) => row.drugId);

	const balanceRows = await getBalanceCandidates(hospitalId, drugIds);
	if (balanceRows.length === 0) {
		return getBalanceCandidates(hospitalId);
	}

	return balanceRows
		.map((row) => ({ ...row, usage: usageMap.get(row.drugId) ?? 0 }))
		.sort(
			(left, right) =>
				left.onHand - right.onHand || right.shortage - left.shortage || right.usage - left.usage
		)
		.slice(0, 10);
};

const getInventoryWarnings = async (hospitalId: string) => {
	const candidates = await getStockoutCandidates(hospitalId);
	return candidates.map((row) => ({
		item: `${row.drugName} (${row.drugId})`,
		value: `${formatQty(row.onHand)}개`,
		status: row.status as 'warn' | 'urgent'
	}));
};

const getStockOrderRows = async (hospitalId: string) => {
	const candidates = await getStockoutCandidates(hospitalId);
	if (candidates.length === 0) {
		return [];
	}

	const candidateIds = candidates.map((item) => item.drugId);
	const orderRows = await drizzleDb
		.select({
			drugId: purchaseOrderItems.drugId,
			orderedQty: purchaseOrderItems.orderedQty,
			orderedAt: purchaseOrders.orderedAt
		})
		.from(purchaseOrderItems)
		.innerJoin(purchaseOrders, eq(purchaseOrderItems.poId, purchaseOrders.id))
		.where(
			and(
				eq(purchaseOrders.hospitalId, hospitalId),
				inArray(purchaseOrderItems.drugId, candidateIds)
			)
		)
		.orderBy(desc(purchaseOrders.orderedAt));

	const latestOrderByDrug = new Map<string, { orderedQty: number; orderedAt: Date | null }>();

	for (const row of orderRows) {
		if (latestOrderByDrug.has(row.drugId)) continue;
		latestOrderByDrug.set(row.drugId, {
			orderedQty: toNumber(row.orderedQty),
			orderedAt: row.orderedAt
		});
	}

	return candidates.map((candidate) => {
		const latestOrder = latestOrderByDrug.get(candidate.drugId);
		return {
			item: candidate.drugName,
			currentStock: `${formatQty(candidate.onHand)}개`,
			orderedQty: latestOrder ? `${formatQty(latestOrder.orderedQty)}개` : '-',
			orderedAt: latestOrder ? toDateLabel(latestOrder.orderedAt) : '-',
			cartAction: '담기'
		};
	});
};

export const mockDb: DatabaseFacade = {
	getDashboardSummary: async (hospitalId = 'HOSP0001') => ({
		...mockSummary,
		inventory: await getInventoryWarnings(hospitalId)
	}),
	getRecentOrders: async (hospitalId = 'HOSP0001') => getStockOrderRows(hospitalId),
	getActivity: async () => mockSummary.activity
};
