import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { parse } from 'csv-parse/sync';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { atcCodes, inpatientPatients, outpatientPatients, usages } from '$lib/server/db/schema';

const EMS_START_DATE = '2024-12-01';
const EMS_END_DATE = '2024-12-07';

type PatientParquetRow = {
	id?: unknown;
	date?: unknown;
	sex?: unknown;
	age?: unknown;
	primary_diagnosis?: unknown;
	secondary_diagnosis?: unknown;
	prescription?: unknown;
	department?: unknown;
};

type AtcColumnMap = {
	real?: number;
};

const toInteger = (value: unknown) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return null;
	return Math.trunc(num);
};

const toDate = (value: unknown) => {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value;
	}

	const date = new Date(String(value ?? ''));
	if (Number.isNaN(date.getTime())) return null;
	return date;
};

const toDateStr = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const toText = (value: unknown) => String(value ?? '').trim();

const isInEmsRange = (date: Date) => {
	const dateStr = toDateStr(date);
	return dateStr >= EMS_START_DATE && dateStr <= EMS_END_DATE;
};

const shiftDays = (value: Date, days: number) => {
	const next = new Date(value);
	next.setDate(next.getDate() + days);
	return next;
};

const toNumericString = (value: string | undefined) => {
	const trimmed = String(value ?? '').trim();
	if (!trimmed) return null;
	const num = Number(trimmed);
	if (Number.isNaN(num)) return null;
	return String(num);
};

const readPatientsFromParquet = async (fileName: string, hospitalId: string) => {
	const filePath = path.resolve(process.cwd(), 'script/seed', fileName);
	const file = await asyncBufferFromFile(filePath);
	const rows = (await parquetReadObjects({ file })) as PatientParquetRow[];

	const patients: Array<Omit<typeof outpatientPatients.$inferInsert, 'id'>> = [];

	for (const row of rows) {
		const now = new Date();
		const patientId = toInteger(row.id);
		const visitDate = toDate(row.date);
		const sex = toInteger(row.sex);
		const age = toInteger(row.age);
		const primaryDiagnosis = toText(row.primary_diagnosis);
		const secondaryDiagnosis = toText(row.secondary_diagnosis);
		const prescription = toText(row.prescription);
		const department = toText(row.department);

		if (
			patientId === null ||
			visitDate === null ||
			sex === null ||
			age === null ||
			!primaryDiagnosis ||
			!secondaryDiagnosis ||
			!prescription ||
			!department ||
			!isInEmsRange(visitDate)
		) {
			continue;
		}

		patients.push({
			hospitalId,
			patientId,
			visitDate,
			sex,
			age,
			primaryDiagnosis,
			secondaryDiagnosis,
			prescription,
			department,
			createdAt: now,
			updatedAt: now
		});
	}

	return patients.sort((left, right) => left.visitDate.getTime() - right.visitDate.getTime());
};

const readEmsPatients = async (
	hospitalId: string,
	inputFileName: string,
	seedFileName: string
) => {
	const directRows = await readPatientsFromParquet(inputFileName, hospitalId);
	if (directRows.length > 0) {
		return { rows: directRows, source: inputFileName };
	}

	const seedRows = await readPatientsFromParquet(seedFileName, hospitalId);
	const fallbackRows = seedRows
		.filter((row) => {
			const dateStr = toDateStr(row.visitDate);
			return dateStr >= '2024-11-24' && dateStr <= '2024-11-30';
		})
		.map((row) => {
			const shiftedDate = shiftDays(row.visitDate, 7);
			return {
				...row,
				visitDate: shiftedDate,
				createdAt: new Date(),
				updatedAt: new Date()
			};
		});

	return { rows: fallbackRows, source: `${seedFileName}(fallback+7d)` };
};

const readActualUsageRows = async (hospitalId: string) => {
	const csvPath = path.resolve(process.cwd(), 'script/seed/LAVAR_persistences.csv');
	const rawCsv = await fs.readFile(csvPath, 'utf-8');
	const records: string[][] = parse(rawCsv, {
		skip_empty_lines: true,
		relax_column_count: true
	});

	if (records.length < 4) {
		throw new Error('CSV does not have enough rows for LAVAR data.');
	}

	const header = records[0];
	const typeRow = records[1];
	const columnMap = new Map<string, AtcColumnMap>();

	for (let i = 1; i < header.length; i += 1) {
		const atcCode = String(header[i] ?? '').trim();
		const type = String(typeRow[i] ?? '').trim();
		if (!atcCode || type !== 'real') continue;
		const existing = columnMap.get(atcCode) ?? {};
		existing.real = i;
		columnMap.set(atcCode, existing);
	}

	const atc5Codes = Array.from(new Set(Array.from(columnMap.keys()).map((code) => code.slice(0, 5))));
	const atcRows = atc5Codes.length
		? await drizzleDb.select({ id: atcCodes.id }).from(atcCodes).where(inArray(atcCodes.id, atc5Codes))
		: [];
	const validAtc5 = new Set(atcRows.map((row) => row.id));

	const usageRows: Array<Omit<typeof usages.$inferInsert, 'id'>> = [];
	for (const row of records.slice(3)) {
		const dateText = String(row[0] ?? '').trim();
		if (!dateText) continue;
		const date = new Date(dateText);
		if (Number.isNaN(date.getTime())) continue;
		const dateStr = toDateStr(date);
		if (dateStr < EMS_START_DATE || dateStr > EMS_END_DATE) continue;

		const now = new Date();
		for (const [atcCode, columns] of columnMap) {
			const atc5 = atcCode.slice(0, 5);
			if (!validAtc5.has(atc5) || columns.real === undefined) continue;
			const realValue = toNumericString(row[columns.real]);
			if (realValue === null) continue;

			usageRows.push({
				hospitalId,
				drugId: atc5,
				quantity: realValue,
				type: 'actual',
				dateStr,
				createdAt: now,
				updatedAt: now
			});
		}
	}

	return usageRows;
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
	const rangeStart = new Date(`${EMS_START_DATE}T00:00:00.000`);
	const rangeEnd = new Date(`${EMS_END_DATE}T23:59:59.999`);

	const [outpatientResult, inpatientResult, actualUsageRows] = await Promise.all([
		readEmsPatients(hospitalId, 'outpatient_input_1.parquet', 'outpatient_seed.parquet'),
		readEmsPatients(hospitalId, 'inpatient_input_1.parquet', 'inpatient_seed.parquet'),
		readActualUsageRows(hospitalId)
	]);
	const outpatientRows = outpatientResult.rows;
	const inpatientRows = inpatientResult.rows;

	await drizzleDb.transaction(async (tx) => {
		await tx
			.delete(outpatientPatients)
			.where(
				and(
					eq(outpatientPatients.hospitalId, hospitalId),
					gte(outpatientPatients.visitDate, rangeStart),
					lte(outpatientPatients.visitDate, rangeEnd)
				)
			);

		await tx
			.delete(inpatientPatients)
			.where(
				and(
					eq(inpatientPatients.hospitalId, hospitalId),
					gte(inpatientPatients.visitDate, rangeStart),
					lte(inpatientPatients.visitDate, rangeEnd)
				)
			);

		await tx
			.delete(usages)
			.where(
				and(
					eq(usages.hospitalId, hospitalId),
					eq(usages.type, 'actual'),
					gte(usages.dateStr, EMS_START_DATE),
					lte(usages.dateStr, EMS_END_DATE)
				)
			);

		await chunkedInsert(outpatientRows, async (chunk) => {
			await tx.insert(outpatientPatients).values(chunk);
		});

		await chunkedInsert(inpatientRows, async (chunk) => {
			await tx.insert(inpatientPatients).values(chunk);
		});

		await chunkedInsert(actualUsageRows, async (chunk) => {
			await tx.insert(usages).values(chunk);
		});
	});

	return json({
		message: 'Patient data successfully inserted.',
		startDate: EMS_START_DATE,
		endDate: EMS_END_DATE,
		outpatientCount: outpatientRows.length,
		inpatientCount: inpatientRows.length,
		actualUsageCount: actualUsageRows.length,
		sources: {
			outpatient: outpatientResult.source,
			inpatient: inpatientResult.source,
			usage: 'LAVAR_persistences.csv(real)'
		}
	});
};
