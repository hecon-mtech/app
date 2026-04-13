import type { OrderItem } from '$lib/server/db';
import { drizzleDb } from '$lib/server/db';
import { auctionBids, auctionRegInventory, configurations, drugs, inventory } from '$lib/server/db/schema';
import { and, desc, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import { ServiceError } from './errors';

export type BannerItem = {
	id: string;
	title: string;
	preview: string;
	detail: string;
	level: 'ok' | 'info' | 'warn';
	action?: 'open-order-modal';
	targetDrugId?: string;
	targetLabel?: string;
};

type StockoutCandidate = {
	drugId: string;
	drugName: string;
	onHand: number;
	status: 'warn' | 'urgent';
	shortage: number;
	usage: number;
};

const DEV_BASE_DATE = new Date('2024-12-07');
const BASELINE_DATE = new Date('2024-12-07T23:59:59.999Z');
const RANGE_OPTIONS = new Set(['1m', '3m', 'all']);

const addDays = (value: Date, days: number) => {
	const next = new Date(value);
	next.setDate(next.getDate() + days);
	return next;
};

const toMinuteLabel = (date: Date) => {
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
};

const toNumeric = (value: string) => {
	const normalized = String(value ?? '').replace(/,/g, '').trim();
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = (value: unknown) => Number(value ?? 0);
const formatQty = (value: number) => (Number.isInteger(value) ? `${value}` : value.toFixed(1));
const formatStockInteger = (value: number) => `${value >= 0 ? Math.ceil(value) : Math.floor(value)}`;

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

const parseNumber = (value: unknown) => {
	const numeric = Number(String(value ?? '').replace(/,/g, '').trim());
	return Number.isFinite(numeric) ? numeric : null;
};

const formatPrice = (value: unknown) => {
	const numeric = parseNumber(value);
	if (numeric === null) return null;
	return `${numeric.toLocaleString('ko-KR')}원`;
};

const formatDateTime = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	const hour = String(value.getHours()).padStart(2, '0');
	const minute = String(value.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hour}:${minute}`;
};

const formatRemaining = (expireAt: Date, now: Date) => {
	const diffMs = expireAt.getTime() - now.getTime();
	if (diffMs <= 0) {
		return { isExpired: true, label: '경매 종료' };
	}

	const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
	const days = Math.floor(totalMinutes / (24 * 60));
	const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
	const minutes = totalMinutes % 60;

	if (days > 0) {
		return { isExpired: false, label: `${days}일 ${hours}시간 ${minutes}분` };
	}

	if (hours > 0) {
		return { isExpired: false, label: `${hours}시간 ${minutes}분` };
	}

	return { isExpired: false, label: `${minutes}분` };
};

const getRangeStart = (range: string) => {
	if (range === '1m') {
		const start = new Date(BASELINE_DATE);
		start.setMonth(start.getMonth() - 1);
		return start;
	}

	if (range === '3m') {
		const start = new Date(BASELINE_DATE);
		start.setMonth(start.getMonth() - 3);
		return start;
	}

	return null;
};

const getReorderThreshold = async (hospitalId: string) => {
	const [row] = await drizzleDb
		.select({ value: configurations.configValue })
		.from(configurations)
		.where(and(eq(configurations.hospitalId, hospitalId), eq(configurations.configId, 'reorder_threshold')))
		.limit(1);

	const parsed = Number(row?.value ?? 80);
	return Number.isFinite(parsed) ? parsed : 80;
};

const getUsageWindowStart = async (hospitalId: string) => {
	const latestRows = await drizzleDb
		.select({ latest: sql<string>`max(${inventory.dateStr})` })
		.from(inventory)
		.where(and(eq(inventory.hospitalId, hospitalId), eq(inventory.type, 'actual')));

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
		.where(and(eq(inventory.hospitalId, hospitalId), eq(inventory.type, 'actual')));

	return latestRows[0]?.latest ?? null;
};

const getBalanceCandidates = async (hospitalId: string, drugIds?: string[]) => {
	const latestInventoryDate = await getLatestInventoryDate(hospitalId);
	if (!latestInventoryDate) {
		return [] as StockoutCandidate[];
	}

	const whereClause =
		drugIds && drugIds.length > 0
			? and(
					eq(inventory.hospitalId, hospitalId),
					eq(inventory.type, 'actual'),
					eq(inventory.dateStr, latestInventoryDate),
					inArray(inventory.drugId, drugIds)
				)
			: and(eq(inventory.hospitalId, hospitalId), eq(inventory.type, 'actual'), eq(inventory.dateStr, latestInventoryDate));

	const balanceRows = await drizzleDb
		.select({
			drugId: inventory.drugId,
			onHand: sql<string>`sum(${inventory.stock})`,
			drugName: drugs.drugName
		})
		.from(inventory)
		.innerJoin(drugs, eq(inventory.drugId, drugs.drugCode))
		.where(whereClause)
		.groupBy(inventory.drugId, drugs.drugName);

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
			} as StockoutCandidate;
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
			drugId: inventory.drugId,
			totalUsage: sql<string>`sum(${inventory.flow})`
		})
		.from(inventory)
		.where(and(eq(inventory.hospitalId, hospitalId), eq(inventory.type, 'actual'), gte(inventory.dateStr, sinceStr)))
		.groupBy(inventory.drugId);

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

export const getInventoryWarnings = async (hospitalId: string) => {
	const candidates = await getStockoutCandidates(hospitalId);
	return candidates.map((row) => ({
		item: `${row.drugName} (${row.drugId})`,
		value: `${formatQty(row.onHand)}개`,
		status: row.status
	}));
};

export const getRecentOrders = async (hospitalId: string): Promise<OrderItem[]> => {
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
			drugId: inventory.drugId,
			totalPrediction: sql<string>`sum(${inventory.flow})`
		})
		.from(inventory)
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				eq(inventory.type, 'prediction'),
				inArray(inventory.drugId, candidateDrugIds),
				gte(inventory.dateStr, nextWeekStartStr),
				lte(inventory.dateStr, nextWeekEndStr)
			)
		)
		.groupBy(inventory.drugId);

	const upperRows = await drizzleDb
		.select({
			drugId: inventory.drugId,
			totalUpper: sql<string>`sum(${inventory.flow})`
		})
		.from(inventory)
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				eq(inventory.type, 'prediction_upper'),
				inArray(inventory.drugId, candidateDrugIds),
				gte(inventory.dateStr, nextWeekStartStr),
				lte(inventory.dateStr, nextWeekEndStr)
			)
		)
		.groupBy(inventory.drugId);

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

export const getStockShortageOrders = async (hospitalId: string) => {
	const orders = await getRecentOrders(hospitalId);

	return {
		columns: ['drugId', 'item', 'currentStock', 'nextWeekBest', 'nextWeekWorst', 'cartAction'],
		rows: orders,
		count: orders.length
	};
};

export const getAuctionOrdersPageData = async (hospitalId: string, requestedRange: string | null) => {
	const now = new Date();
	const range = RANGE_OPTIONS.has((requestedRange ?? 'all').trim()) ? (requestedRange ?? 'all').trim() : 'all';
	const rangeStart = getRangeStart(range);
	const whereClause = rangeStart
		? and(eq(auctionRegInventory.hospitalId, hospitalId), gte(auctionRegInventory.createdAt, rangeStart))
		: eq(auctionRegInventory.hospitalId, hospitalId);

	const rows = await drizzleDb
		.select({
			id: auctionRegInventory.id,
			title: drugs.drugName,
			quantity: auctionRegInventory.quantity,
			expireAt: auctionRegInventory.expireAt,
			bidCount: sql<number>`count(${auctionBids.id})`,
			minBidPrice: sql<string | null>`min(${auctionBids.price})`
		})
		.from(auctionRegInventory)
		.innerJoin(drugs, eq(auctionRegInventory.drugId, drugs.drugCode))
		.leftJoin(auctionBids, eq(auctionBids.regInventoryId, auctionRegInventory.id))
		.where(whereClause)
		.groupBy(
			auctionRegInventory.id,
			drugs.drugName,
			auctionRegInventory.quantity,
			auctionRegInventory.expireAt,
			auctionRegInventory.createdAt
		)
		.orderBy(desc(auctionRegInventory.createdAt));

	return {
		orders: rows.map((row) => {
			const bidCount = Number(row.bidCount ?? 0);
			const hasBids = bidCount > 0;
			const remaining = formatRemaining(row.expireAt, now);

			return {
				id: row.id,
				title: row.title,
				quantity: String(row.quantity),
				bidCount,
				minBidPrice: hasBids ? formatPrice(row.minBidPrice) : null,
				minBidPriceLabel: hasBids
					? (formatPrice(row.minBidPrice) ?? '현재 입찰 건수가 없습니다.')
					: '현재 입찰 건수가 없습니다.',
				expireAtIso: row.expireAt.toISOString(),
				expireAtLabel: formatDateTime(row.expireAt),
				remainingTimeLabel: remaining.label,
				isExpired: remaining.isExpired
			};
		}),
		range
	};
};

export const getCurrentAuctionStatus = async (hospitalId: string, requestedRange: string | null) => {
	const page = await getAuctionOrdersPageData(hospitalId, requestedRange);
	const activeCount = page.orders.filter((order) => !order.isExpired).length;
	const expiredCount = page.orders.length - activeCount;

	return {
		range: page.range,
		summary: {
			total: page.orders.length,
			active: activeCount,
			expired: expiredCount
		},
		orders: page.orders
	};
};

export const getBannerItems = async (hospitalId: string) => {
	const orders = await getRecentOrders(hospitalId);
	const now = new Date();
	const items: BannerItem[] = [];

	const alarmRows = orders.filter((row) => {
		const currentStock = toNumeric(row.currentStock);
		const nextWeekBest = toNumeric(row.nextWeekBest);
		const nextWeekWorst = toNumeric(row.nextWeekWorst);
		return (
			(currentStock !== null && currentStock <= 0) ||
			(nextWeekBest !== null && nextWeekBest <= 0) ||
			(nextWeekWorst !== null && nextWeekWorst <= 0)
		);
	});

	const alarmDrugIds = Array.from(new Set(alarmRows.map((row) => row.drugId)));
	const activeOrderRows =
		alarmDrugIds.length > 0
			? await drizzleDb
					.select({ drugId: auctionRegInventory.drugId })
					.from(auctionRegInventory)
					.where(
						and(
							eq(auctionRegInventory.hospitalId, hospitalId),
							inArray(auctionRegInventory.drugId, alarmDrugIds),
							gt(auctionRegInventory.expireAt, now)
						)
					)
			: [];

	const activeDrugIds = new Set(activeOrderRows.map((row) => row.drugId));

	for (const row of alarmRows) {
		if (activeDrugIds.has(row.drugId)) {
			continue;
		}

		items.push({
			id: `stock-risk-${row.drugId}`,
			title: '재고/예측 경보',
			preview: `${row.item} (현재 ${row.currentStock}, best ${row.nextWeekBest}, worst ${row.nextWeekWorst})`,
			detail: `${row.item}의 재고 또는 다음주 재고 예상이 0 이하입니다. 눌러서 상세 주문 모달을 열고 즉시 주문을 등록하세요.`,
			level: 'warn',
			action: 'open-order-modal',
			targetDrugId: row.drugId,
			targetLabel: row.item
		});
	}

	items.push(
		{
			id: 'system-status',
			title: '시스템 상태',
			preview: `DB 동기화 정상 (${toMinuteLabel(now)} 기준)`,
			detail: `병원 ${hospitalId} 데이터 기준으로 ${toMinuteLabel(now)}에 상태를 갱신했습니다.`,
			level: 'ok'
		},
		{
			id: 'system-sync',
			title: '동기화 알림',
			preview: '1분 주기 API polling 및 DB 상태 점검 중',
			detail: '배너 스토어는 1분마다 서버 API를 호출해 최신 재고 소진 경보 및 운영 상태를 반영합니다.',
			level: 'info'
		}
	);

	return { items };
};

export const createAuctionOrder = async (hospitalId: string, payload: unknown) => {
	const drugId = typeof (payload as { drugId?: unknown })?.drugId === 'string' ? (payload as { drugId: string }).drugId.trim() : '';
	const quantityValue = Number((payload as { quantity?: unknown })?.quantity);
	const quantity = Number.isInteger(quantityValue) ? quantityValue : NaN;

	if (!drugId) {
		throw new ServiceError(400, 'drugId is required.');
	}

	if (!Number.isInteger(quantity) || quantity <= 0) {
		throw new ServiceError(400, 'quantity must be a positive integer.');
	}

	const [drugRow] = await drizzleDb
		.select({ drugCode: drugs.drugCode })
		.from(drugs)
		.where(eq(drugs.drugCode, drugId))
		.limit(1);

	if (!drugRow) {
		throw new ServiceError(400, '유효하지 않은 약품 코드입니다.');
	}

	const createdAt = new Date();
	const expireAt = addDays(createdAt, 2);

	try {
		const [inserted] = await drizzleDb
			.insert(auctionRegInventory)
			.values({
				hospitalId,
				drugId,
				quantity: String(quantity),
				expireAt,
				createdAt,
				updatedAt: createdAt
			})
			.returning({ id: auctionRegInventory.id });

		return {
			message: '주문이 등록되었습니다.',
			id: inserted.id,
			drugId,
			quantity,
			expireAt: expireAt.toISOString()
		};
	} catch {
		throw new ServiceError(500, '주문 등록에 실패했습니다.');
	}
};
