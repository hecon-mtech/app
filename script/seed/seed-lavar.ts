import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { atcCodes, usagePredictionBounds, usages } from '../../src/lib/server/db/schema';

const filePath = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve('script/seed/LAVAR_persistences.csv');

const dbConfig = {
	host: process.env.DB_HOST ?? '127.0.0.1',
	port: Number(process.env.DB_PORT ?? 5432),
	user: process.env.DB_USER ?? 'postgres',
	password: process.env.DB_PASSWORD ?? 'postgres',
	database: process.env.DB_NAME ?? 'hecon',
	ssl:
		process.env.DB_SSL === 'true'
			? {
					rejectUnauthorized: false
				}
			: false
};

const hospitalId = process.env.SEED_HOSPITAL_ID ?? 'HOSP0001';
const modelName = process.env.SEED_MODEL ?? 'LAVAR';
const ACTUAL_CUTOFF_DATE = '2024-11-30';
const PREDICTION_CUTOFF_DATE = '2024-12-07';

const pool = new Pool(dbConfig);
const db = drizzle(pool);

const rawCsv = await fs.readFile(filePath, 'utf-8');
const records: string[][] = parse(rawCsv, {
	skip_empty_lines: true,
	relax_column_count: true
});

if (records.length < 4) {
	throw new Error('CSV does not have enough rows for headers and data.');
}

const header = records[0];
const typeRow = records[1];

type AtcColumnMap = {
	real?: number;
	pred?: number;
	upper?: number;
	lower?: number;
};

const columnMap = new Map<string, AtcColumnMap>();

for (let i = 1; i < header.length; i += 1) {
	const atcCode = String(header[i] ?? '').trim();
	const type = String(typeRow[i] ?? '').trim();
	if (!atcCode || !type) continue;

	const existing = columnMap.get(atcCode) ?? {};
	if (type === 'real') existing.real = i;
	if (type === 'pred') existing.pred = i;
	if (type === 'pred_upper') existing.upper = i;
	if (type === 'pred_lower') existing.lower = i;
	columnMap.set(atcCode, existing);
}

const atc5Codes = Array.from(
	new Set(Array.from(columnMap.keys()).map((code) => code.slice(0, 5)))
);
const atcRows = atc5Codes.length
	? await db.select({ id: atcCodes.id }).from(atcCodes).where(inArray(atcCodes.id, atc5Codes))
	: [];
const validAtc5 = new Set(atcRows.map((row) => row.id));

const toNumericString = (value: string | undefined) => {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return null;
	const num = Number(trimmed);
	if (Number.isNaN(num)) return null;
	return trimmed;
};

const usageBatch: {
	hospitalId: string;
	drugId: string;
	quantity: string;
	type: 'actual' | 'prediction';
	dateStr: string;
	createdAt: Date;
	updatedAt: Date;
}[] = [];

const boundsBatch: {
	hospitalId: string;
	drugId: string;
	dateStr: string;
	upper: string;
	lower: string;
	createdAt: Date;
	updatedAt: Date;
}[] = [];

const toDateStr = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const flushBatch = async () => {
	if (usageBatch.length > 0) {
		await db.insert(usages).values(usageBatch);
		usageBatch.length = 0;
	}
	if (boundsBatch.length > 0) {
		await db.insert(usagePredictionBounds).values(boundsBatch);
		boundsBatch.length = 0;
	}
};

await db.delete(usages).where(eq(usages.hospitalId, hospitalId));
await db.delete(usagePredictionBounds).where(eq(usagePredictionBounds.hospitalId, hospitalId));

const dataRows = records.slice(3);
const chunkSize = 1000;

	for (const row of dataRows) {
		const dateText = String(row[0] ?? '').trim();
		if (!dateText) continue;
		const date = new Date(dateText);
		if (Number.isNaN(date.getTime())) continue;
		const dateStr = toDateStr(date);
		const now = new Date();

	for (const [atcCode, columns] of columnMap) {
		const atc5 = atcCode.slice(0, 5);
		if (!validAtc5.has(atc5) || columns.real === undefined || columns.pred === undefined) {
			continue;
		}

		const realValue = toNumericString(row[columns.real]);
		if (realValue !== null && dateStr <= ACTUAL_CUTOFF_DATE) {
			usageBatch.push({
				hospitalId,
				drugId: atc5,
				quantity: realValue,
				type: 'actual',
				dateStr,
				createdAt: now,
				updatedAt: now
			});
		}

		const predValue = toNumericString(row[columns.pred]);
		const upperValue = toNumericString(row[columns.upper ?? -1]);
		const lowerValue = toNumericString(row[columns.lower ?? -1]);
		if (predValue !== null && dateStr <= PREDICTION_CUTOFF_DATE) {
			usageBatch.push({
				hospitalId,
				drugId: atc5,
				quantity: predValue,
				type: 'prediction',
				dateStr,
				createdAt: now,
				updatedAt: now
			});

			boundsBatch.push({
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

	if (usageBatch.length >= chunkSize || boundsBatch.length >= chunkSize) {
		await flushBatch();
	}
}

await flushBatch();
await pool.end();

console.log(`Seeded usage(actual+prediction) data for hospital ${hospitalId} (${modelName}).`);
