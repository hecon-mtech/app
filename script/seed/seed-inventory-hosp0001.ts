import path from 'node:path';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { Pool } from 'pg';

type InventorySeedParquetRow = {
	date?: unknown;
	insurance_code?: unknown;
	hospital_id?: unknown;
	flow?: unknown;
	type_?: unknown;
	stock?: unknown;
};

const TARGET_HOSPITAL_ID = 'HOSP0001';

const filePath = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve('script/data/hosp0001_inventory_seed.parquet');

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

const toNumericString = (value: unknown) => {
	const text = typeof value === 'bigint' ? value.toString() : String(value ?? '').trim();
	if (!text) return null;
	const num = Number(text);
	if (!Number.isFinite(num)) return null;
	return text;
};

const toFlowType = (value: unknown) => {
	const normalized = toText(value).toLowerCase();
	if (
		normalized === 'prediction' ||
		normalized === 'actual' ||
		normalized === 'prediction_upper' ||
		normalized === 'prediction_lower'
	) {
		return normalized;
	}
	return null;
};

const file = await asyncBufferFromFile(filePath);
const rows = (await parquetReadObjects({ file })) as InventorySeedParquetRow[];

const now = new Date();
const inventoryRows = rows
	.map((row) => ({
		hospitalId: toText(row.hospital_id),
		dateStr: toText(row.date),
		drugId: toText(row.insurance_code),
		flow: toNumericString(row.flow),
		type: toFlowType(row.type_),
		stock: toNumericString(row.stock),
		createdAt: now,
		updatedAt: now
	}))
	.filter(
		(row): row is {
			hospitalId: string;
			dateStr: string;
			drugId: string;
			flow: string;
			type: 'prediction' | 'actual' | 'prediction_upper' | 'prediction_lower';
			stock: string;
			createdAt: Date;
			updatedAt: Date;
		} =>
			row.hospitalId === TARGET_HOSPITAL_ID &&
			row.dateStr.length > 0 &&
			row.drugId.length > 0 &&
			row.flow !== null &&
			row.type !== null &&
			row.stock !== null
	);

const pool = new Pool(dbConfig);

try {
	await pool.query('BEGIN');

	const deletedResult = await pool.query('DELETE FROM inventory WHERE hospital_id = $1', [TARGET_HOSPITAL_ID]);

	const chunkSize = 1000;
	let inserted = 0;

	for (let i = 0; i < inventoryRows.length; i += chunkSize) {
		const batch = inventoryRows.slice(i, i + chunkSize);
		const valuesSql = batch
			.map((_, index) => {
				const base = index * 8;
				return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
			})
			.join(', ');

		const params = batch.flatMap((row) => [
			row.hospitalId,
			row.dateStr,
			row.drugId,
			row.flow,
			row.type,
			row.stock,
			row.createdAt,
			row.updatedAt
		]);

		await pool.query(
			`INSERT INTO inventory (
				hospital_id,
				date_str,
				drug_id,
				flow,
				type_,
				stock,
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
		`Seeded ${inserted} inventory rows for ${TARGET_HOSPITAL_ID} from ${path.basename(filePath)} after deleting ${deletedResult.rowCount} existing rows.`
	);
} catch (error) {
	await pool.query('ROLLBACK');
	throw error;
} finally {
	await pool.end();
}
