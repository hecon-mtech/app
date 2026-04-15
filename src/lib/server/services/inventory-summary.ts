import { and, eq, gte, lte, asc, inArray } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { inventory } from '$lib/server/db/schema/inventory';
import { drugs } from '$lib/server/db/schema/catalog';
import { getToday } from '$lib/server/today';

export type RecentInventorySummary = {
	period: { start: string; end: string };
	totalDrugs: number;
	byDrug: Array<{
		drugId: string;
		drugName: string;
		totalFlow: number;
		latestStock: number | null;
	}>;
};

export type OrderSuggestion = {
	drugCode: string;
	drugName: string;
	futurePredictionSum: number;
	suggestedOrder: number;
};

export type OrderSuggestionResult = {
	predictionStartDate: string;
	suggestions: OrderSuggestion[];
};

export type InventoryPrediction = {
	drugCode: string;
	drugName: string;
	predictionStartDate: string;
	period: { start: string; end: string };
	byDateSeries: Array<{
		date: string;
		actual: number | null;
		prediction: number | null;
		predictionUpper: number | null;
		predictionLower: number | null;
	}>;
	orderSuggestion: OrderSuggestion | null;
};

const toDateStr = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const testAnchor = () => getToday();

/** Historical actual usage grouped by drug. */
export const summarizeRecentInventory = async (
	hospitalId: string,
	startDate?: string,
	endDate?: string
): Promise<RecentInventorySummary> => {
	let startStr: string;
	let endStr: string;

	if (startDate && endDate) {
		startStr = startDate;
		endStr = endDate;
	} else if (startDate) {
		startStr = startDate;
		endStr = startDate;
	} else {
		const anchor = testAnchor();
		endStr = toDateStr(anchor);
		const s = new Date(anchor);
		s.setDate(s.getDate() - 13);
		startStr = toDateStr(s);
	}

	const rows = await drizzleDb
		.select({
			drugId: inventory.drugId,
			drugName: drugs.drugName,
			dateStr: inventory.dateStr,
			flow: inventory.flow,
			stock: inventory.stock,
			type: inventory.type
		})
		.from(inventory)
		.innerJoin(drugs, eq(inventory.drugId, drugs.drugCode))
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				eq(inventory.type, 'actual'),
				gte(inventory.dateStr, startStr),
				lte(inventory.dateStr, endStr)
			)
		)
		.orderBy(asc(inventory.dateStr), asc(inventory.drugId));

	const drugMap = new Map<string, { drugName: string; totalFlow: number; latestDate: string; latestStock: number | null }>();

	for (const row of rows) {
		const flow = Number(row.flow) || 0;
		const stock = row.stock !== null ? Number(row.stock) : null;
		const existing = drugMap.get(row.drugId);
		if (!existing) {
			drugMap.set(row.drugId, { drugName: row.drugName, totalFlow: flow, latestDate: row.dateStr, latestStock: stock });
		} else {
			existing.totalFlow += flow;
			if (row.dateStr >= existing.latestDate) {
				existing.latestDate = row.dateStr;
				if (stock !== null) existing.latestStock = stock;
			}
		}
	}

	return {
		period: { start: startStr, end: endStr },
		totalDrugs: drugMap.size,
		byDrug: Array.from(drugMap.entries())
			.map(([drugId, s]) => ({ drugId, drugName: s.drugName, totalFlow: s.totalFlow, latestStock: s.latestStock }))
			.sort((a, b) => b.totalFlow - a.totalFlow)
	};
};

/** Single-drug prediction chart: 2 weeks before + 2 weeks after prediction_start_date. */
export const inventoryPrediction = async (
	hospitalId: string,
	drugCode: string,
	predictionStartDate?: string
): Promise<InventoryPrediction> => {
	const anchor = predictionStartDate ? new Date(predictionStartDate) : testAnchor();
	const anchorStr = toDateStr(anchor);

	const startAnchor = new Date(anchor);
	startAnchor.setDate(startAnchor.getDate() - 14);
	const startStr = toDateStr(startAnchor);

	const endAnchor = new Date(anchor);
	endAnchor.setDate(endAnchor.getDate() + 13);
	const endStr = toDateStr(endAnchor);

	const rows = await drizzleDb
		.select({
			drugId: inventory.drugId,
			drugName: drugs.drugName,
			dateStr: inventory.dateStr,
			flow: inventory.flow,
			stock: inventory.stock,
			type: inventory.type
		})
		.from(inventory)
		.innerJoin(drugs, eq(inventory.drugId, drugs.drugCode))
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				eq(inventory.drugId, drugCode),
				inArray(inventory.type, ['actual', 'prediction', 'prediction_upper', 'prediction_lower']),
				gte(inventory.dateStr, startStr),
				lte(inventory.dateStr, endStr)
			)
		)
		.orderBy(asc(inventory.dateStr));

	// Collect raw values per date
	const seriesMap = new Map<string, { actual: number; prediction: number; predictionUpper: number; predictionLower: number }>();
	let drugName = drugCode;

	for (const row of rows) {
		const flow = Number(row.flow) || 0;
		if (row.drugName) drugName = row.drugName;

		if (!seriesMap.has(row.dateStr)) {
			seriesMap.set(row.dateStr, { actual: 0, prediction: 0, predictionUpper: 0, predictionLower: 0 });
		}
		const entry = seriesMap.get(row.dateStr)!;
		if (row.type === 'actual') entry.actual += flow;
		else if (row.type === 'prediction') entry.prediction += flow;
		else if (row.type === 'prediction_upper') entry.predictionUpper += flow;
		else if (row.type === 'prediction_lower') entry.predictionLower += flow;
	}

	// Split into historical (before anchor) vs future (>= anchor)
	const byDateSeries = Array.from(seriesMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, s]) => {
			const isFuture = date >= anchorStr;
			return {
				date,
				actual: isFuture ? null : s.actual,
				prediction: s.prediction,
				predictionUpper: s.predictionUpper,
				predictionLower: s.predictionLower
			};
		});

	// Compute order suggestion from the already-fetched rows
	let actual2wSum = 0;
	let predicted2wSum = 0;
	let futurePredictionSum = 0;
	let currentStock = 0;

	for (const row of rows) {
		const flow = Number(row.flow) || 0;
		const isFuture = row.dateStr >= anchorStr;
		if (row.type === 'actual' && !isFuture) {
			actual2wSum += flow;
			const stock = row.stock !== null ? Number(row.stock) : null;
			if (stock !== null) currentStock = stock;
		}
		if (row.type === 'prediction' && !isFuture) predicted2wSum += flow;
		if (row.type === 'prediction' && isFuture) futurePredictionSum += flow;
	}

	let orderSuggestion: OrderSuggestion | null = null;
	if (predicted2wSum > 0) {
		const adjustment = actual2wSum / predicted2wSum;
		const suggestedOrder = Math.round(adjustment * futurePredictionSum - currentStock);
		if (suggestedOrder > 0) {
			orderSuggestion = {
				drugCode,
				drugName,
				futurePredictionSum: Math.round(futurePredictionSum),
				suggestedOrder
			};
		}
	}

	return {
		drugCode,
		drugName,
		predictionStartDate: anchorStr,
		period: { start: startStr, end: endStr },
		byDateSeries,
		orderSuggestion
	};
};

/** Suggest order quantities for one or all drugs. */
export const suggestOrder = async (
	hospitalId: string,
	drugId?: string
): Promise<OrderSuggestionResult> => {
	const anchor = testAnchor();
	const anchorStr = toDateStr(anchor);

	const startAnchor = new Date(anchor);
	startAnchor.setDate(startAnchor.getDate() - 14);
	const startStr = toDateStr(startAnchor);

	const endAnchor = new Date(anchor);
	endAnchor.setDate(endAnchor.getDate() + 13);
	const endStr = toDateStr(endAnchor);

	const conditions = [
		eq(inventory.hospitalId, hospitalId),
		inArray(inventory.type, ['actual', 'prediction']),
		gte(inventory.dateStr, startStr),
		lte(inventory.dateStr, endStr)
	];
	if (drugId) conditions.push(eq(inventory.drugId, drugId));

	const rows = await drizzleDb
		.select({
			drugId: inventory.drugId,
			drugName: drugs.drugName,
			dateStr: inventory.dateStr,
			flow: inventory.flow,
			stock: inventory.stock,
			type: inventory.type
		})
		.from(inventory)
		.innerJoin(drugs, eq(inventory.drugId, drugs.drugCode))
		.where(and(...conditions))
		.orderBy(asc(inventory.dateStr));

	const drugMap = new Map<
		string,
		{ drugName: string; actual2wSum: number; predicted2wSum: number; futurePredictionSum: number; currentStock: number }
	>();

	for (const row of rows) {
		const flow = Number(row.flow) || 0;
		const isFuture = row.dateStr >= anchorStr;

		if (!drugMap.has(row.drugId)) {
			drugMap.set(row.drugId, {
				drugName: row.drugName,
				actual2wSum: 0,
				predicted2wSum: 0,
				futurePredictionSum: 0,
				currentStock: 0
			});
		}
		const entry = drugMap.get(row.drugId)!;

		if (row.type === 'actual' && !isFuture) {
			entry.actual2wSum += flow;
			const stock = row.stock !== null ? Number(row.stock) : null;
			if (stock !== null) entry.currentStock = stock;
		}
		if (row.type === 'prediction' && !isFuture) entry.predicted2wSum += flow;
		if (row.type === 'prediction' && isFuture) entry.futurePredictionSum += flow;
	}

	const suggestions: OrderSuggestion[] = [];

	for (const [code, entry] of drugMap) {
		if (entry.predicted2wSum <= 0) continue;
		const adjustment = entry.actual2wSum / entry.predicted2wSum;
		const suggestedOrder = Math.round(adjustment * entry.futurePredictionSum - entry.currentStock);
		if (suggestedOrder <= 0) continue;
		suggestions.push({
			drugCode: code,
			drugName: entry.drugName,
			futurePredictionSum: Math.round(entry.futurePredictionSum),
			suggestedOrder
		});
	}

	suggestions.sort((a, b) => b.suggestedOrder - a.suggestedOrder);

	return { predictionStartDate: anchorStr, suggestions };
};
