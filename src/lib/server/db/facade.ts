import type { ActivityPoint, DashboardSummary, OrderItem } from './types';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { drizzleDb } from './drizzle';
import { atcCodes, configurations, inventory, usagePredictionBounds, usages } from './schema';

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
const formatStockInteger = (value: number) =>
	`${value >= 0 ? Math.ceil(value) : Math.floor(value)}`;
const DEV_BASE_DATE = new Date('2024-12-07');

const toDate = (value: unknown) => {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date;
};

const toDateStr = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const addDays = (value: Date, days: number) => {
	const next = new Date(value);
	next.setDate(next.getDate() + days);
	return next;
};

const getReorderThreshold = async (hospitalId: string) => {
	const [row] = await drizzleDb
		.select({ value: configurations.configValue })
		.from(configurations)
		.where(
			and(
				eq(configurations.hospitalId, hospitalId),
				eq(configurations.configId, 'reorder_threshold')
			)
		)
		.limit(1);

	const parsed = Number(row?.value ?? 80);
	return Number.isFinite(parsed) ? parsed : 80;
};

const getUsageWindowStart = async (hospitalId: string) => {
	const latestRows = await drizzleDb
		.select({ latest: sql<string>`max(${usages.dateStr})` })
		.from(usages)
		.where(and(eq(usages.hospitalId, hospitalId), eq(usages.type, 'actual')));

	const latestUsageDate = toDate(latestRows[0]?.latest);
	const anchor = latestUsageDate ?? DEV_BASE_DATE;
	const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
	start.setMonth(start.getMonth() - 3);
	return start;
};

const getLatestInventoryDate = async (hospitalId: string) => {
	const latestRows = await drizzleDb
		.select({ latest: sql<string>`max(${inventory.dateStr})` })
		.from(inventory)
		.where(eq(inventory.hospitalId, hospitalId));

	return latestRows[0]?.latest ?? null;
};

const getBalanceCandidates = async (hospitalId: string, drugIds?: string[]) => {
	const latestInventoryDate = await getLatestInventoryDate(hospitalId);
	if (!latestInventoryDate) {
		return [];
	}

	const whereClause =
		drugIds && drugIds.length > 0
			? and(
					eq(inventory.hospitalId, hospitalId),
					eq(inventory.dateStr, latestInventoryDate),
					inArray(inventory.drugId, drugIds)
				)
			: and(eq(inventory.hospitalId, hospitalId), eq(inventory.dateStr, latestInventoryDate));

	const balanceRows = await drizzleDb
		.select({
			drugId: inventory.drugId,
			onHand: sql<string>`sum(${inventory.quantity})`,
			drugName: atcCodes.name
		})
		.from(inventory)
		.innerJoin(atcCodes, eq(inventory.drugId, atcCodes.id))
		.where(whereClause)
		.groupBy(inventory.drugId, atcCodes.name);

	const threshold = await getReorderThreshold(hospitalId);

	return balanceRows
		.map((row) => {
			const onHand = toNumber(row.onHand);
			return {
				drugId: row.drugId,
				drugName: row.drugName,
				onHand,
				status: onHand <= 0 ? 'urgent' : 'warn',
				shortage: threshold - onHand,
				usage: 0
			};
		})
		.filter((row) => row.shortage >= 0)
		.sort((left, right) => left.onHand - right.onHand || right.shortage - left.shortage)
		.slice(0, 10);
};

const getStockoutCandidates = async (hospitalId: string) => {
	const since = await getUsageWindowStart(hospitalId);
	const sinceStr = toDateStr(since);

	const usageRows = await drizzleDb
		.select({
			drugId: usages.drugId,
			totalUsage: sql<string>`sum(${usages.quantity})`
		})
		.from(usages)
		.where(
			and(
				eq(usages.hospitalId, hospitalId),
				eq(usages.type, 'actual'),
				gte(usages.dateStr, sinceStr)
			)
		)
		.groupBy(usages.drugId);

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

	const latestInventoryDateText = await getLatestInventoryDate(hospitalId);
	const latestInventoryDate = toDate(latestInventoryDateText);
	if (!latestInventoryDate) {
		return candidates.map((candidate) => ({
			drugId: candidate.drugId,
			item: candidate.drugName,
			currentStock: formatStockInteger(candidate.onHand),
			nextWeekBest: formatStockInteger(candidate.onHand),
			nextWeekWorst: formatStockInteger(candidate.onHand),
			cartAction: '상세 주문'
		}));
	}

	const nextWeekStart = addDays(latestInventoryDate, 1);
	const nextWeekEnd = addDays(latestInventoryDate, 7);
	const nextWeekStartStr = toDateStr(nextWeekStart);
	const nextWeekEndStr = toDateStr(nextWeekEnd);
	const candidateDrugIds = candidates.map((candidate) => candidate.drugId);

	const predictionRows = await drizzleDb
		.select({
			drugId: usages.drugId,
			totalPrediction: sql<string>`sum(${usages.quantity})`
		})
		.from(usages)
		.where(
			and(
				eq(usages.hospitalId, hospitalId),
				eq(usages.type, 'prediction'),
				inArray(usages.drugId, candidateDrugIds),
				gte(usages.dateStr, nextWeekStartStr),
				lte(usages.dateStr, nextWeekEndStr)
			)
		)
		.groupBy(usages.drugId);

	const upperRows = await drizzleDb
		.select({
			drugId: usagePredictionBounds.drugId,
			totalUpper: sql<string>`sum(${usagePredictionBounds.upper})`
		})
		.from(usagePredictionBounds)
		.where(
			and(
				eq(usagePredictionBounds.hospitalId, hospitalId),
				inArray(usagePredictionBounds.drugId, candidateDrugIds),
				gte(usagePredictionBounds.dateStr, nextWeekStartStr),
				lte(usagePredictionBounds.dateStr, nextWeekEndStr)
			)
		)
		.groupBy(usagePredictionBounds.drugId);

	const predictionMap = new Map(predictionRows.map((row) => [row.drugId, toNumber(row.totalPrediction)]));
	const upperMap = new Map(upperRows.map((row) => [row.drugId, toNumber(row.totalUpper)]));

	return candidates.map((candidate) => {
		const predictedUsage = predictionMap.get(candidate.drugId) ?? 0;
		const upperUsage = upperMap.get(candidate.drugId) ?? predictedUsage;
		const nextWeekBest = candidate.onHand - predictedUsage;
		const nextWeekWorst = candidate.onHand - upperUsage;

		return {
			drugId: candidate.drugId,
			item: candidate.drugName,
			currentStock: formatStockInteger(candidate.onHand),
			nextWeekBest: formatStockInteger(nextWeekBest),
			nextWeekWorst: formatStockInteger(nextWeekWorst),
			cartAction: '상세 주문'
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
