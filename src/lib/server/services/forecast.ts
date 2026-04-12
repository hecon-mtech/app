import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { getRepresentativeDrugsByAtcPrefixes } from '$lib/server/db/drug-groups';
import { inventory } from '$lib/server/db/schema';
import { ServiceError } from './errors';

const NEXT_WEEK_START = '2024-12-08';
const NEXT_WEEK_END = '2024-12-14';
const PREDICTION_DELAY_MS = 5000;

type AtcColumnMap = {
	pred?: number;
	upper?: number;
	lower?: number;
};

const parseDate = (value: string | null | undefined) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toDateKey = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const toDateStr = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const getDateRange = (start: Date, end: Date) => {
	const days: Date[] = [];
	const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	while (cursor <= end) {
		days.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
		cursor.setDate(cursor.getDate() + 1);
	}
	return days;
};

const toNumericString = (value: string | undefined) => {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return null;
	const num = Number(trimmed);
	if (Number.isNaN(num)) return null;
	return String(num);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const chunkedInsert = async <T>(values: T[], insertChunk: (chunk: T[]) => Promise<unknown>) => {
	const chunkSize = 1000;
	for (let i = 0; i < values.length; i += chunkSize) {
		const chunk = values.slice(i, i + chunkSize);
		if (chunk.length > 0) {
			await insertChunk(chunk);
		}
	}
};

const loadNextWeekPredictionRows = async (hospitalId: string) => {
	const filePath = path.resolve(process.cwd(), 'script/seed/LAVAR_persistences.csv');
	const rawCsv = await fs.readFile(filePath, 'utf-8');
	const records: string[][] = parse(rawCsv, {
		skip_empty_lines: true,
		relax_column_count: true
	});

	if (records.length < 4) {
		throw new ServiceError(500, 'CSV does not have enough rows for prediction seed data.');
	}

	const header = records[0];
	const typeRow = records[1];
	const columnMap = new Map<string, AtcColumnMap>();

	for (let i = 1; i < header.length; i += 1) {
		const atcCode = String(header[i] ?? '').trim();
		const type = String(typeRow[i] ?? '').trim();
		if (!atcCode || !type) continue;

		const existing = columnMap.get(atcCode) ?? {};
		if (type === 'pred') existing.pred = i;
		if (type === 'pred_upper') existing.upper = i;
		if (type === 'pred_lower') existing.lower = i;
		columnMap.set(atcCode, existing);
	}

	const atcPrefixes = Array.from(new Set(Array.from(columnMap.keys()).map((code) => code.slice(0, 5))));
	const representativeDrugs = await getRepresentativeDrugsByAtcPrefixes(atcPrefixes);

	const inventoryRows: Array<Omit<typeof inventory.$inferInsert, 'id'>> = [];
	const dataRows = records.slice(3);

	for (const row of dataRows) {
		const dateText = String(row[0] ?? '').trim();
		if (!dateText) continue;
		const date = new Date(dateText);
		if (Number.isNaN(date.getTime())) continue;
		const dateStr = toDateStr(date);
		if (dateStr < NEXT_WEEK_START || dateStr > NEXT_WEEK_END) {
			continue;
		}

		const now = new Date();

		for (const [atcCode, columns] of columnMap) {
			const representativeDrug = representativeDrugs.get(atcCode.slice(0, 5));
			if (!representativeDrug || columns.pred === undefined) {
				continue;
			}

			const predValue = toNumericString(row[columns.pred]);
			if (predValue === null) continue;

			const upperValue = toNumericString(row[columns.upper ?? -1]);
			const lowerValue = toNumericString(row[columns.lower ?? -1]);

			inventoryRows.push({
				hospitalId,
				drugId: representativeDrug.drugCode,
				flow: predValue,
				type: 'prediction',
				stock: '0',
				dateStr,
				createdAt: now,
				updatedAt: now
			});

			inventoryRows.push({
				hospitalId,
				drugId: representativeDrug.drugCode,
				flow: upperValue ?? predValue,
				dateStr,
				type: 'prediction_upper',
				stock: '0',
				createdAt: now,
				updatedAt: now
			});

			inventoryRows.push({
				hospitalId,
				drugId: representativeDrug.drugCode,
				flow: lowerValue ?? predValue,
				dateStr,
				type: 'prediction_lower',
				stock: '0',
				createdAt: now,
				updatedAt: now
			});
		}
	}

	return { inventoryRows };
};

export const getUsageForecast = async ({
	hospitalId,
	drugId,
	start,
	end,
	actualEnd
}: {
	hospitalId: string;
	drugId: string | null;
	start: string | null;
	end: string | null;
	actualEnd?: string | null;
}) => {
	const normalizedDrugId = drugId?.trim() ?? '';
	const startDate = parseDate(start);
	const endDate = parseDate(end);
	const actualEndDate = parseDate(actualEnd ?? null);

	if (!normalizedDrugId || !startDate || !endDate) {
		throw new ServiceError(400, 'Missing required parameters.');
	}

	const labels = getDateRange(startDate, endDate).map(toDateKey);
	const actualMap = new Map<string, number>();
	const predictionMap = new Map<string, number>();
	const upperMap = new Map<string, number>();
	const lowerMap = new Map<string, number>();
	const startStr = toDateStr(startDate);
	const endStr = toDateStr(endDate);
	const actualEndStr = actualEndDate ? toDateStr(actualEndDate) : null;

	if (actualEndDate && actualEndDate >= startDate && actualEndStr) {
		const usageRows = await drizzleDb
			.select({ date: inventory.dateStr, flow: sql<string>`sum(${inventory.flow})` })
			.from(inventory)
			.where(
				and(
					eq(inventory.hospitalId, hospitalId),
					eq(inventory.drugId, normalizedDrugId),
					eq(inventory.type, 'actual'),
					gte(inventory.dateStr, startStr),
					lte(inventory.dateStr, actualEndStr)
				)
			)
			.groupBy(inventory.dateStr);

		for (const row of usageRows) {
			actualMap.set(row.date, Number(row.flow));
		}
	}

	const predictionRows = await drizzleDb
		.select({ date: inventory.dateStr, flow: sql<string>`sum(${inventory.flow})` })
		.from(inventory)
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				eq(inventory.drugId, normalizedDrugId),
				eq(inventory.type, 'prediction'),
				gte(inventory.dateStr, startStr),
				lte(inventory.dateStr, endStr)
			)
		)
		.groupBy(inventory.dateStr);

	for (const row of predictionRows) {
		predictionMap.set(row.date, Number(row.flow));
	}

	const upperRows = await drizzleDb
		.select({ date: inventory.dateStr, flow: sql<string>`sum(${inventory.flow})` })
		.from(inventory)
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				eq(inventory.drugId, normalizedDrugId),
				eq(inventory.type, 'prediction_upper'),
				gte(inventory.dateStr, startStr),
				lte(inventory.dateStr, endStr)
			)
		)
		.groupBy(inventory.dateStr);

	for (const row of upperRows) {
		upperMap.set(row.date, Number(row.flow));
	}

	const lowerRows = await drizzleDb
		.select({ date: inventory.dateStr, flow: sql<string>`sum(${inventory.flow})` })
		.from(inventory)
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				eq(inventory.drugId, normalizedDrugId),
				eq(inventory.type, 'prediction_lower'),
				gte(inventory.dateStr, startStr),
				lte(inventory.dateStr, endStr)
			)
		)
		.groupBy(inventory.dateStr);

	for (const row of lowerRows) {
		lowerMap.set(row.date, Math.max(0, Number(row.flow)));
	}

	return {
		labels,
		actual: labels.map((label) => actualMap.get(label) ?? null),
		prediction: labels.map((label) => predictionMap.get(label) ?? null),
		upper: labels.map((label) => upperMap.get(label) ?? null),
		lower: labels.map((label) => lowerMap.get(label) ?? null)
	};
};

export const getUsageForecastDrugOptions = async ({
	hospitalId,
	start,
	end
}: {
	hospitalId: string;
	start: string | null;
	end: string | null;
}) => {
	const startDate = parseDate(start);
	const endDate = parseDate(end);

	if (!startDate || !endDate) {
		throw new ServiceError(400, 'Missing required parameters.');
	}

	const usageRows = await drizzleDb
		.select({ drugId: inventory.drugId })
		.from(inventory)
		.where(
			and(
				eq(inventory.hospitalId, hospitalId),
				gte(inventory.dateStr, toDateStr(startDate)),
				lte(inventory.dateStr, toDateStr(endDate))
			)
		);

	return { drugIds: Array.from(new Set(usageRows.map((row) => row.drugId))) };
};

export const refreshNextWeekPrediction = async (hospitalId: string) => {
	await wait(PREDICTION_DELAY_MS);

	const { inventoryRows } = await loadNextWeekPredictionRows(hospitalId);
	const predictionCount = inventoryRows.filter((row) => row.type === 'prediction').length;

	await drizzleDb.transaction(async (tx) => {
		await tx
			.delete(inventory)
			.where(
				and(
					eq(inventory.hospitalId, hospitalId),
					inArray(inventory.type, ['prediction', 'prediction_upper', 'prediction_lower']),
					gte(inventory.dateStr, NEXT_WEEK_START),
					lte(inventory.dateStr, NEXT_WEEK_END)
				)
			);

		await chunkedInsert(inventoryRows, async (chunk) => {
			await tx.insert(inventory).values(chunk);
		});
	});

	return {
		message: '다음주 예측이 반영되었습니다.',
		startDate: NEXT_WEEK_START,
		endDate: NEXT_WEEK_END,
		predictionCount
	};
};
