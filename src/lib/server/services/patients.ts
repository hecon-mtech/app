import fs from 'node:fs/promises';
import path from 'node:path';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { parse } from 'csv-parse/sync';
import { and, eq, gte, lte } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { getRepresentativeDrugsByAtcPrefixes } from '$lib/server/db/drug-groups';
import { inventory, patients } from '$lib/server/db/schema';
import { ServiceError } from './errors';

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

const chunkedInsert = async <T>(values: T[], insertChunk: (chunk: T[]) => Promise<unknown>) => {
	const chunkSize = 1000;
	for (let i = 0; i < values.length; i += chunkSize) {
		const chunk = values.slice(i, i + chunkSize);
		if (chunk.length > 0) {
			await insertChunk(chunk);
		}
	}
};

const readPatientsFromParquet = async (
	fileName: string,
	hospitalId: string,
	type: 'inpatient' | 'outpatient'
) => {
	const filePath = path.resolve(process.cwd(), 'script/seed', fileName);
	const file = await asyncBufferFromFile(filePath);
	const rows = (await parquetReadObjects({ file })) as PatientParquetRow[];

	const patientRows: Array<Omit<typeof patients.$inferInsert, 'id'>> = [];

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

		patientRows.push({
			hospitalId,
			patientId,
			visitDate,
			type,
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

	return patientRows.sort((left, right) => left.visitDate.getTime() - right.visitDate.getTime());
};

const readEmsPatients = async (
	hospitalId: string,
	inputFileName: string,
	seedFileName: string,
	type: 'inpatient' | 'outpatient'
) => {
	const directRows = await readPatientsFromParquet(inputFileName, hospitalId, type);
	if (directRows.length > 0) {
		return { rows: directRows, source: inputFileName };
	}

	const seedRows = await readPatientsFromParquet(seedFileName, hospitalId, type);
	const fallbackRows = seedRows
		.filter((row) => {
			const dateStr = toDateStr(row.visitDate);
			return dateStr >= '2024-11-24' && dateStr <= '2024-11-30';
		})
		.map((row) => ({
			...row,
			visitDate: shiftDays(row.visitDate, 7),
			createdAt: new Date(),
			updatedAt: new Date()
		}));

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
		throw new ServiceError(500, 'CSV does not have enough rows for LAVAR data.');
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

	const atcPrefixes = Array.from(new Set(Array.from(columnMap.keys()).map((code) => code.slice(0, 5))));
	const representativeDrugs = await getRepresentativeDrugsByAtcPrefixes(atcPrefixes);

	const usageRows: Array<Omit<typeof inventory.$inferInsert, 'id'>> = [];
	for (const row of records.slice(3)) {
		const dateText = String(row[0] ?? '').trim();
		if (!dateText) continue;
		const date = new Date(dateText);
		if (Number.isNaN(date.getTime())) continue;
		const dateStr = toDateStr(date);
		if (dateStr < EMS_START_DATE || dateStr > EMS_END_DATE) continue;

		const now = new Date();
		for (const [atcCode, columns] of columnMap) {
			const representativeDrug = representativeDrugs.get(atcCode.slice(0, 5));
			if (!representativeDrug || columns.real === undefined) continue;
			const realValue = toNumericString(row[columns.real]);
			if (realValue === null) continue;

			// Until a dedicated stock feed is added, mirror the imported actual value into stock.
			usageRows.push({
				hospitalId,
				drugId: representativeDrug.drugCode,
				flow: realValue,
				type: 'actual',
				stock: realValue,
				dateStr,
				createdAt: now,
				updatedAt: now
			});
		}
	}

	return usageRows;
};

export const pullEmsPatientData = async (hospitalId: string) => {
	const rangeStart = new Date(`${EMS_START_DATE}T00:00:00.000`);
	const rangeEnd = new Date(`${EMS_END_DATE}T23:59:59.999`);

	const [outpatientResult, inpatientResult, actualUsageRows] = await Promise.all([
		readEmsPatients(hospitalId, 'outpatient_input_1.parquet', 'outpatient_seed.parquet', 'outpatient'),
		readEmsPatients(hospitalId, 'inpatient_input_1.parquet', 'inpatient_seed.parquet', 'inpatient'),
		readActualUsageRows(hospitalId)
	]);

	await drizzleDb.transaction(async (tx) => {
		await tx
			.delete(patients)
			.where(
				and(
					eq(patients.hospitalId, hospitalId),
					eq(patients.type, 'outpatient'),
					gte(patients.visitDate, rangeStart),
					lte(patients.visitDate, rangeEnd)
				)
			);

		await tx
			.delete(patients)
			.where(
				and(
					eq(patients.hospitalId, hospitalId),
					eq(patients.type, 'inpatient'),
					gte(patients.visitDate, rangeStart),
					lte(patients.visitDate, rangeEnd)
				)
			);

		await tx
			.delete(inventory)
			.where(
				and(
					eq(inventory.hospitalId, hospitalId),
					eq(inventory.type, 'actual'),
					gte(inventory.dateStr, EMS_START_DATE),
					lte(inventory.dateStr, EMS_END_DATE)
				)
			);

		await chunkedInsert(outpatientResult.rows, async (chunk) => {
			await tx.insert(patients).values(chunk);
		});

		await chunkedInsert(inpatientResult.rows, async (chunk) => {
			await tx.insert(patients).values(chunk);
		});

		await chunkedInsert(actualUsageRows, async (chunk) => {
			await tx.insert(inventory).values(chunk);
		});
	});

	return {
		message: 'Patient data successfully inserted.',
		startDate: EMS_START_DATE,
		endDate: EMS_END_DATE,
		outpatientCount: outpatientResult.rows.length,
		inpatientCount: inpatientResult.rows.length,
		actualUsageCount: actualUsageRows.length,
		sources: {
			outpatient: outpatientResult.source,
			inpatient: inpatientResult.source,
			usage: 'LAVAR_persistences.csv(real)'
		}
	};
};
