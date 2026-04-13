import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from '../../src/lib/server/db/schema';
import { hashPassword } from '../../src/lib/server/auth';

const defaultModelId = 'gpt-5.2-codex';

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

const hashed = hashPassword('test');
const now = new Date();
const seedUsers: Array<typeof users.$inferInsert> = [
	{
		id: 'HOSP0001',
		name: '하나이비인후과병원',
		password: hashed,
		description: 'hospital',
		defaultModelId,
		createdAt: now,
		updatedAt: now
	},
	{
		id: 'HOSP0002',
		name: '이푸른병원',
		password: hashed,
		description: 'hospital',
		defaultModelId,
		createdAt: now,
		updatedAt: now
	}
];

await db.insert(users).values(seedUsers).onConflictDoNothing();

await pool.end();

console.log('Seeded example users.');
