import fs from 'node:fs/promises';
import path from 'node:path';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { drugs } from '../../src/lib/server/db/schema';

const filePath = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve('script/seed/ATC_20250912_110516.csv');

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

const pool = new Pool(dbConfig);
const db = drizzle(pool);

const buffer = await fs.readFile(filePath);
const decoded = iconv.decode(buffer, 'euc-kr');

const records = parse(decoded, {
	from_line: 2,
	skip_empty_lines: true,
	relax_column_count: true
});

const toAtc5 = (value: string) => value.slice(0, 5);

const rows = records
	.map((row: string[]) => ({
		fdaClass: String(row[0] ?? '').trim(),
		ingredientCode: String(row[1] ?? '').trim(),
		drugCode: String(row[2] ?? '').trim(),
		drugName: String(row[3] ?? '').trim(),
		manufactor: String(row[4] ?? '').trim(),
		atcCode: String(row[5] ?? '').trim(),
		atcName: String(row[6] ?? '').trim(),
		atc5: toAtc5(String(row[5] ?? '').trim())
	}))
	.filter((row) => row.drugCode.length > 0 && row.atc5.length === 5);

const chunkSize = 1000;
let inserted = 0;

for (let i = 0; i < rows.length; i += chunkSize) {
	const batch = rows.slice(i, i + chunkSize);
	await db.insert(drugs).values(batch).onConflictDoNothing();
	inserted += batch.length;
}

await pool.end();

console.log(`Seeded ${inserted} drug rows from ${path.basename(filePath)}.`);
