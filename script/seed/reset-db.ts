import { Pool } from 'pg';

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

try {
	await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE;');
	await pool.query('DROP SCHEMA IF EXISTS public CASCADE;');
	await pool.query('CREATE SCHEMA public;');
	await pool.query('GRANT ALL ON SCHEMA public TO CURRENT_USER;');
	await pool.query('GRANT ALL ON SCHEMA public TO public;');
	console.log('Database reset complete.');
} finally {
	await pool.end();
}
