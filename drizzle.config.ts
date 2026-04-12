import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
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
	}
});
