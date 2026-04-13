import fs from 'node:fs/promises';
import path from 'node:path';
import { asyncBufferFromFile, parquetReadObjects, type AsyncBuffer } from 'hyparquet';
import { parse } from 'csv-parse/sync';
import { and, eq, gte, lte } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { drizzleDb } from '$lib/server/db';
import { getRepresentativeDrugsByAtcPrefixes } from '$lib/server/db/drug-groups';
import { inventory, patients } from '$lib/server/db/schema';
import { ServiceError } from './errors';

type PatientSex = typeof patients.$inferInsert.sex;

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

const toPatientSex = (value: unknown): PatientSex | null => {
	if (value === 1 || value === '1') return 'male';
	if (value === 2 || value === '2') return 'female';

	const normalized = String(value ?? '').trim().toLowerCase();
	if (normalized === 'male' || normalized === 'm') return 'male';
	if (normalized === 'female' || normalized === 'f') return 'female';
	if (normalized === 'unknown' || normalized === '') return 'unknown';

	return null;
};

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
		const sex = toPatientSex(row.sex);
		const age = toInteger(row.age);
		const primaryDiagnosis = toText(row.primary_diagnosis);
		const department = toText(row.department);

		if (
			patientId === null ||
			visitDate === null ||
			sex === null ||
			age === null ||
			!primaryDiagnosis ||
			!department ||
			!isInEmsRange(visitDate)
		) {
			continue;
		}

		patientRows.push({
			hospitalId,
			patientId,
			visitDateStr: toDateStr(visitDate),
			type,
			sex,
			age,
			diagnosisCode: primaryDiagnosis,
			isPrimaryDiagnosis: true,
			departmentStr: department,
			createdAt: now,
			updatedAt: now
		});
	}

	return patientRows.sort((left, right) => left.visitDateStr.localeCompare(right.visitDateStr));
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
			const dateStr = row.visitDateStr;
			return dateStr >= '2024-11-24' && dateStr <= '2024-11-30';
		})
		.map((row) => ({
			...row,
			visitDateStr: toDateStr(shiftDays(new Date(`${row.visitDateStr}T00:00:00.000`), 7)),
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
	const rangeStart = EMS_START_DATE;
	const rangeEnd = EMS_END_DATE;

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
					gte(patients.visitDateStr, rangeStart),
					lte(patients.visitDateStr, rangeEnd)
				)
			);

		await tx
			.delete(patients)
			.where(
				and(
					eq(patients.hospitalId, hospitalId),
					eq(patients.type, 'inpatient'),
					gte(patients.visitDateStr, rangeStart),
					lte(patients.visitDateStr, rangeEnd)
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

export type PatientImportType = 'inpatient' | 'outpatient';

type UploadedPatientInputRow = {
	id?: unknown;
	date?: unknown;
	sex?: unknown;
	age?: unknown;
	primary_diagnosis?: unknown;
	secondary_diagnosis?: unknown;
	prescription?: unknown;
	department?: unknown;
};

const asyncBufferFromArrayBuffer = (arrayBuffer: ArrayBuffer): AsyncBuffer => ({
	byteLength: arrayBuffer.byteLength,
	slice: (start, end) => arrayBuffer.slice(start, end)
});

const normalizeHeader = (value: unknown) =>
	String(value ?? '')
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9가-힣]+/g, '');

const HEADER_ALIASES = {
	id: ['id', 'patientid', 'patient_id', '환자id', '환자번호'],
	date: ['date', 'visitdate', 'visit_date', '방문일', '내원일', '진료일', '방문날짜'],
	sex: ['sex', 'gender', '성별'],
	age: ['age', '나이', '연령'],
	primary_diagnosis: ['primarydiagnosis', 'primary_diagnosis', '주상병', '주진단'],
	secondary_diagnosis: ['secondarydiagnosis', 'secondary_diagnosis', '부상병', '부진단'],
	prescription: ['prescription', '처방', '처방내역'],
	department: ['department', 'dept', '진료과', '부서']
} satisfies Record<keyof UploadedPatientInputRow, string[]>;

const resolvePatientType = (input: unknown, fallbackFileName = ''): PatientImportType => {
	const normalized = String(input ?? '').trim().toLowerCase();
	if (normalized === 'inpatient' || normalized === 'outpatient') {
		return normalized;
	}

	const fileName = fallbackFileName.toLowerCase();
	if (fileName.includes('inpatient') || fileName.includes('입원')) {
		return 'inpatient';
	}

	if (fileName.includes('outpatient') || fileName.includes('외래')) {
		return 'outpatient';
	}

	throw new ServiceError(400, '파일명에 inpatient 또는 outpatient를 포함하거나 patientType을 지정해주세요.');
};

const normalizeWorkbookDate = (value: unknown) => {
	if (typeof value === 'number') {
		const parsed = XLSX.SSF.parse_date_code(value);
		if (parsed) {
			return new Date(parsed.y, parsed.m - 1, parsed.d);
		}
	}

	return toDate(value);
};

const toUploadedPatientRows = (
	rows: UploadedPatientInputRow[],
	hospitalId: string,
	type: PatientImportType
) => {
	const patientRows: Array<Omit<typeof patients.$inferInsert, 'id'>> = [];

	for (const row of rows) {
		const now = new Date();
		const patientId = toInteger(row.id);
		const visitDate = normalizeWorkbookDate(row.date);
		const sex = toPatientSex(row.sex);
		const age = toInteger(row.age);
		const primaryDiagnosis = toText(row.primary_diagnosis);
		const department = toText(row.department);

		if (
			patientId === null ||
			visitDate === null ||
			sex === null ||
			age === null ||
			!primaryDiagnosis ||
			!department
		) {
			continue;
		}

		patientRows.push({
			hospitalId,
			patientId,
			visitDateStr: toDateStr(visitDate),
			type,
			sex,
			age,
			diagnosisCode: primaryDiagnosis,
			isPrimaryDiagnosis: true,
			departmentStr: department,
			createdAt: now,
			updatedAt: now
		});
	}

	return patientRows.sort((left, right) => left.visitDateStr.localeCompare(right.visitDateStr));
};

const readPatientsFromParquetBuffer = async (
	arrayBuffer: ArrayBuffer,
	hospitalId: string,
	type: PatientImportType
) => {
	const rows = (await parquetReadObjects({ file: asyncBufferFromArrayBuffer(arrayBuffer) })) as PatientParquetRow[];
	return toUploadedPatientRows(rows, hospitalId, type);
};

const mapWorkbookRow = (row: Record<string, unknown>) => {
	const normalizedEntries = new Map(
		Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
	);

	const getValue = (key: keyof UploadedPatientInputRow) => {
		for (const alias of HEADER_ALIASES[key]) {
			const value = normalizedEntries.get(alias);
			if (value !== undefined) return value;
		}
		return undefined;
	};

	return {
		id: getValue('id'),
		date: getValue('date'),
		sex: getValue('sex'),
		age: getValue('age'),
		primary_diagnosis: getValue('primary_diagnosis'),
		secondary_diagnosis: getValue('secondary_diagnosis'),
		prescription: getValue('prescription'),
		department: getValue('department')
	} satisfies UploadedPatientInputRow;
};

const readPatientsFromWorkbookBuffer = (
	arrayBuffer: ArrayBuffer,
	hospitalId: string,
	type: PatientImportType
) => {
	const workbook = XLSX.read(arrayBuffer, { type: 'array' });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) {
		throw new ServiceError(400, '엑셀 파일에서 시트를 찾을 수 없습니다.');
	}

	const sheet = workbook.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
		defval: '',
		raw: true
	});

	return toUploadedPatientRows(rows.map(mapWorkbookRow), hospitalId, type);
};

export const importUploadedPatientData = async ({
	hospitalId,
	fileName,
	arrayBuffer,
	patientType
}: {
	hospitalId: string;
	fileName: string;
	arrayBuffer: ArrayBuffer;
	patientType?: string | null;
}) => {
	const normalizedFileName = String(fileName ?? '').trim();
	const extension = path.extname(normalizedFileName).toLowerCase();
	const type = resolvePatientType(patientType, normalizedFileName);

	const rows =
		extension === '.parquet'
			? await readPatientsFromParquetBuffer(arrayBuffer, hospitalId, type)
			: extension === '.xlsx'
				? readPatientsFromWorkbookBuffer(arrayBuffer, hospitalId, type)
				: null;

	if (!rows) {
		throw new ServiceError(400, '지원하지 않는 파일 형식입니다. .xlsx 또는 .parquet 파일만 업로드할 수 있습니다.');
	}

	if (rows.length === 0) {
		throw new ServiceError(400, '업로드 파일에서 저장 가능한 환자 데이터를 찾지 못했습니다.');
	}

	const startDate = rows[0]?.visitDateStr;
	const endDate = rows[rows.length - 1]?.visitDateStr;
	if (!startDate || !endDate) {
		throw new ServiceError(400, '업로드 파일의 방문일 정보를 해석하지 못했습니다.');
	}

	await drizzleDb.transaction(async (tx) => {
		await tx
			.delete(patients)
			.where(
				and(
					eq(patients.hospitalId, hospitalId),
					eq(patients.type, type),
					gte(patients.visitDateStr, startDate),
					lte(patients.visitDateStr, endDate)
				)
			);

		await chunkedInsert(rows, async (chunk) => {
			await tx.insert(patients).values(chunk);
		});
	});

	return {
		message: `${type === 'inpatient' ? '입원' : '외래'} 환자 데이터 ${rows.length}건을 반영했습니다.`,
		patientType: type,
		insertedCount: rows.length,
		startDate,
		endDate,
		fileName: normalizedFileName
	};
};
