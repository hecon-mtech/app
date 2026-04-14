import { Pool } from 'pg';

const CUTOFF_DATE = '2024-11-25';

const dbConfig = {
	host: process.env.DB_HOST ?? '127.0.0.1',
	port: Number(process.env.DB_PORT ?? 5432),
	user: process.env.DB_USER ?? 'postgres',
	password: process.env.DB_PASSWORD ?? 'postgres',
	database: process.env.DB_NAME ?? 'hecon',
	ssl:
		process.env.DB_SSL === 'true'
			? { rejectUnauthorized: false }
			: false
};

const pool = new Pool(dbConfig);

try {
	const result = await pool.query(
		`DELETE FROM inventory WHERE date_str > $1`,
		[CUTOFF_DATE]
	);
	console.log(
		`Demo trim complete: deleted ${result.rowCount} inventory rows with date_str > '${CUTOFF_DATE}'.`
	);
} catch (error) {
	console.error('Demo trim failed:', error);
	process.exit(1);
} finally {
	await pool.end();
}
