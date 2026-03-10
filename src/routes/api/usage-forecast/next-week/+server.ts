import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { atcCodes, usagePredictionBounds, usages } from '$lib/server/db/schema';

const NEXT_WEEK_START = '2024-12-08';
const NEXT_WEEK_END = '2024-12-14';
const PREDICTION_DELAY_MS = 5000;

type AtcColumnMap = {
	pred?: number;
	upper?: number;
	lower?: number;
};

const toDateStr = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const toNumericString = (value: string | undefined) => {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return null;
	const num = Number(trimmed);
	if (Number.isNaN(num)) return null;
	return String(num);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loadNextWeekPredictionRows = async (hospitalId: string) => {
	const filePath = path.resolve(process.cwd(), 'script/seed/LAVAR_persistences.csv');
	const rawCsv = await fs.readFile(filePath, 'utf-8');
	const records: string[][] = parse(rawCsv, {
		skip_empty_lines: true,
		relax_column_count: true
	});

	if (records.length < 4) {
		throw new Error('CSV does not have enough rows for prediction seed data.');
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

	const atc5Codes = Array.from(new Set(Array.from(columnMap.keys()).map((code) => code.slice(0, 5))));
	const atcRows = atc5Codes.length
		? await drizzleDb.select({ id: atcCodes.id }).from(atcCodes).where(inArray(atcCodes.id, atc5Codes))
		: [];
	const validAtc5 = new Set(atcRows.map((row) => row.id));

	const usageRows: Array<Omit<typeof usages.$inferInsert, 'id'>> = [];
	const boundRows: Array<Omit<typeof usagePredictionBounds.$inferInsert, 'id'>> = [];
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
			const atc5 = atcCode.slice(0, 5);
			if (!validAtc5.has(atc5) || columns.pred === undefined) {
				continue;
			}

			const predValue = toNumericString(row[columns.pred]);
			if (predValue === null) continue;

			const upperValue = toNumericString(row[columns.upper ?? -1]);
			const lowerValue = toNumericString(row[columns.lower ?? -1]);

			usageRows.push({
				hospitalId,
				drugId: atc5,
				quantity: predValue,
				type: 'prediction',
				dateStr,
				createdAt: now,
				updatedAt: now
			});

			boundRows.push({
				hospitalId,
				drugId: atc5,
				dateStr,
				upper: upperValue ?? predValue,
				lower: lowerValue ?? predValue,
				createdAt: now,
				updatedAt: now
			});
		}
	}

	return { usageRows, boundRows };
};

const chunkedInsert = async <T>(values: T[], insertChunk: (chunk: T[]) => Promise<unknown>) => {
	const chunkSize = 1000;
	for (let i = 0; i < values.length; i += chunkSize) {
		const chunk = values.slice(i, i + chunkSize);
		if (chunk.length > 0) {
			await insertChunk(chunk);
		}
	}
};

export const POST: RequestHandler = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';

	await wait(PREDICTION_DELAY_MS);

	const { usageRows, boundRows } = await loadNextWeekPredictionRows(hospitalId);

	await drizzleDb.transaction(async (tx) => {
		await tx
			.delete(usagePredictionBounds)
			.where(
				and(
					eq(usagePredictionBounds.hospitalId, hospitalId),
					gte(usagePredictionBounds.dateStr, NEXT_WEEK_START),
					lte(usagePredictionBounds.dateStr, NEXT_WEEK_END)
				)
			);

		await tx
			.delete(usages)
			.where(
				and(
					eq(usages.hospitalId, hospitalId),
					eq(usages.type, 'prediction'),
					gte(usages.dateStr, NEXT_WEEK_START),
					lte(usages.dateStr, NEXT_WEEK_END)
				)
			);

		await chunkedInsert(usageRows, async (chunk) => {
			await tx.insert(usages).values(chunk);
		});

		await chunkedInsert(boundRows, async (chunk) => {
			await tx.insert(usagePredictionBounds).values(chunk);
		});
	});

	return json({
		message: '다음주 예측이 반영되었습니다.',
		startDate: NEXT_WEEK_START,
		endDate: NEXT_WEEK_END,
		predictionCount: usageRows.length
	});
};
