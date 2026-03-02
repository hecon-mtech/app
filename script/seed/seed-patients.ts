import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { inpatientPatients, outpatientPatients } from '../../src/lib/server/db/schema';

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

type PatientSeedRow = Omit<typeof outpatientPatients.$inferInsert, 'id'>;

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

const toText = (value: unknown) => String(value ?? '').trim();

const readPatients = async (filePath: string) => {
	const file = await asyncBufferFromFile(filePath);
	const rows = (await parquetReadObjects({ file })) as PatientParquetRow[];

	const patients: PatientSeedRow[] = [];

	for (const row of rows) {
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
			!department
		) {
			continue;
		}

		patients.push({
			patientId,
			visitDate,
			sex,
			age,
			primaryDiagnosis,
			secondaryDiagnosis,
			prescription,
			department
		});
	}

	return patients;
};

const chunkedInsert = async <T>(
	values: T[],
	insertChunk: (chunk: T[]) => Promise<unknown>,
	chunkSize = 1000
) => {
	for (let i = 0; i < values.length; i += chunkSize) {
		const chunk = values.slice(i, i + chunkSize);
		if (chunk.length > 0) {
			await insertChunk(chunk);
		}
	}
};

const pool = new Pool(dbConfig);
const db = drizzle(pool);

const outpatientPath = path.resolve('script/seed/outpatient_seed.parquet');
const inpatientPath = path.resolve('script/seed/inpatient_seed.parquet');

const outpatientRows = await readPatients(outpatientPath);
const inpatientRows = await readPatients(inpatientPath);

await db.delete(inpatientPatients);
await db.delete(outpatientPatients);

await chunkedInsert(outpatientRows, async (chunk) => {
	await db.insert(outpatientPatients).values(chunk);
});

await chunkedInsert(inpatientRows, async (chunk) => {
	await db.insert(inpatientPatients).values(chunk);
});

await pool.end();

console.log(
	`Seeded patients: ${outpatientRows.length} outpatient rows and ${inpatientRows.length} inpatient rows.`
);
