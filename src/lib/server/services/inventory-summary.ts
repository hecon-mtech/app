import { and, eq, gte, lte, sql, asc } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { drizzleDb } from '$lib/server/db';
import { inventory } from '$lib/server/db/schema/inventory';
import { drugs } from '$lib/server/db/schema/catalog';

export type InventorySummary = {
	period: { start: string; end: string };
	totalDrugs: number;
	byDrug: Array<{
		drugId: string;
		drugName: string;
		totalFlow: number;
		latestStock: number | null;
	}>;
	byDate: Array<{
		date: string;
		totalFlow: number;
		drugCount: number;
	}>;
};

const toDateStr = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

export const summarizeInventory = async (
	hospitalId: string,
	startDate?: string,
	endDate?: string
): Promise<InventorySummary> => {
	const testMode = env.TEST_MODE === 'true';
	let startStr: string;
	let endStr: string;

	if (startDate && endDate) {
		startStr = startDate;
		endStr = endDate;
	} else if (startDate) {
		startStr = startDate;
		endStr = startDate;
	} else {
		const anchor = testMode ? new Date('2024-11-30') : new Date();
		endStr = toDateStr(anchor);
		const startAnchor = new Date(anchor);
		startAnchor.setDate(startAnchor.getDate() - 13);
		startStr = toDateStr(startAnchor);
	}

	const rows = await drizzleDb
		.select({
			drugId: inventory.drugId,
			drugName: drugs.drugName,
			dateStr: inventory.dateStr,
			flow: inventory.flow,
			stock: inventory.stock
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
	const dateMap = new Map<string, { totalFlow: number; drugIds: Set<string> }>();

	for (const row of rows) {
		const flow = Number(row.flow) || 0;
		const stock = row.stock !== null ? Number(row.stock) : null;

		const existing = drugMap.get(row.drugId);
		if (!existing) {
			drugMap.set(row.drugId, {
				drugName: row.drugName,
				totalFlow: flow,
				latestDate: row.dateStr,
				latestStock: stock
			});
		} else {
			existing.totalFlow += flow;
			if (row.dateStr >= existing.latestDate) {
				existing.latestDate = row.dateStr;
				existing.latestStock = stock;
			}
		}

		const dateEntry = dateMap.get(row.dateStr);
		if (!dateEntry) {
			dateMap.set(row.dateStr, { totalFlow: flow, drugIds: new Set([row.drugId]) });
		} else {
			dateEntry.totalFlow += flow;
			dateEntry.drugIds.add(row.drugId);
		}
	}

	const byDrug = Array.from(drugMap.entries())
		.map(([drugId, stats]) => ({
			drugId,
			drugName: stats.drugName,
			totalFlow: stats.totalFlow,
			latestStock: stats.latestStock
		}))
		.sort((a, b) => b.totalFlow - a.totalFlow);

	const byDate = Array.from(dateMap.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, stats]) => ({
			date,
			totalFlow: stats.totalFlow,
			drugCount: stats.drugIds.size
		}));

	return {
		period: { start: startStr, end: endStr },
		totalDrugs: drugMap.size,
		byDrug,
		byDate
	};
};
