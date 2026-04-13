import path from 'node:path';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { Pool } from 'pg';

type PatientSeedParquetRow = {
	hospital_id?: unknown;
	patient_id?: unknown;
	visit_date_str?: unknown;
	type?: unknown;
	sex?: unknown;
	age?: unknown;
	diagnosis_code?: unknown;
	department_str?: unknown;
	is_primary_diagnosis?: unknown;
};

const TARGET_HOSPITAL_ID = 'HOSP0001';

const filePath = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve('script/data/hosp0001_patient_seed.parquet');

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

const toText = (value: unknown) => String(value ?? '').trim();

const toInteger = (value: unknown) => {
	if (typeof value === 'bigint') return Number(value);
	const num = Number(value);
	if (!Number.isFinite(num)) return null;
	return Math.trunc(num);
};

const toBoolean = (value: unknown) => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'bigint') return value !== 0n;
	if (typeof value === 'number') return value !== 0;

	const normalized = String(value ?? '').trim().toLowerCase();
	if (normalized === 'true' || normalized === '1') return true;
	if (normalized === 'false' || normalized === '0') return false;
	return null;
};

const toPatientType = (value: unknown) => {
	const normalized = toText(value).toLowerCase();
	if (normalized === 'inpatient' || normalized === 'outpatient') return normalized;
	return null;
};

const toPatientSex = (value: unknown) => {
	const normalized = toText(value).toLowerCase();
	if (normalized === 'male' || normalized === 'female' || normalized === 'unknown') return normalized;
	return null;
};

const file = await asyncBufferFromFile(filePath);
const rows = (await parquetReadObjects({ file })) as PatientSeedParquetRow[];

const now = new Date();
const patientRows = rows
	.map((row) => ({
		hospitalId: toText(row.hospital_id),
		patientId: toInteger(row.patient_id),
		visitDateStr: toText(row.visit_date_str),
		type: toPatientType(row.type),
		sex: toPatientSex(row.sex),
		age: toInteger(row.age),
		diagnosisCode: toText(row.diagnosis_code),
		departmentStr: toText(row.department_str),
		isPrimaryDiagnosis: toBoolean(row.is_primary_diagnosis),
		createdAt: now,
		updatedAt: now
	}))
	.filter(
		(row): row is {
			hospitalId: string;
			patientId: number;
			visitDateStr: string;
			type: 'inpatient' | 'outpatient';
			sex: 'male' | 'female' | 'unknown';
			age: number;
			diagnosisCode: string;
			departmentStr: string;
			isPrimaryDiagnosis: boolean;
			createdAt: Date;
			updatedAt: Date;
		} =>
			row.hospitalId === TARGET_HOSPITAL_ID &&
			row.patientId !== null &&
			row.visitDateStr.length > 0 &&
			row.type !== null &&
			row.sex !== null &&
			row.age !== null &&
			row.diagnosisCode.length > 0 &&
			row.departmentStr.length > 0 &&
			row.isPrimaryDiagnosis !== null
	);

const pool = new Pool(dbConfig);

try {
	await pool.query('BEGIN');

	const deletedResult = await pool.query('DELETE FROM patients WHERE hospital_id = $1', [TARGET_HOSPITAL_ID]);

	const chunkSize = 1000;
	let inserted = 0;

	for (let i = 0; i < patientRows.length; i += chunkSize) {
		const batch = patientRows.slice(i, i + chunkSize);
		const valuesSql = batch
			.map((_, index) => {
				const base = index * 11;
				return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`;
			})
			.join(', ');

		const params = batch.flatMap((row) => [
			row.hospitalId,
			row.patientId,
			row.visitDateStr,
			row.type,
			row.sex,
			row.age,
			row.diagnosisCode,
			row.isPrimaryDiagnosis,
			row.departmentStr,
			row.createdAt,
			row.updatedAt
		]);

		await pool.query(
			`INSERT INTO patients (
				hospital_id,
				patient_id,
				visit_date_str,
				type,
				sex,
				age,
				diagnosis_code,
				is_primary_diagnosis,
				department_str,
				created_at,
				updated_at
			)
			VALUES ${valuesSql}`,
			params
		);

		inserted += batch.length;
	}

	await pool.query('COMMIT');

	console.log(
		`Seeded ${inserted} patient rows for ${TARGET_HOSPITAL_ID} from ${path.basename(filePath)} after deleting ${deletedResult.rowCount} existing rows.`
	);
} catch (error) {
	await pool.query('ROLLBACK');
	throw error;
} finally {
	await pool.end();
}
