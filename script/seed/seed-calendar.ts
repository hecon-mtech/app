import path from 'node:path';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { Pool } from 'pg';

type CalendarParquetRow = {
	__index_level_0__?: unknown;
	day_after_holiday?: unknown;
	is_holiday?: unknown;
	holiday_streak_len?: unknown;
	days_since_streak_end?: unknown;
	post_streak_surge?: unknown;
	month_sin?: unknown;
	month_cos?: unknown;
};

const filePath = process.argv[2]
	? path.resolve(process.argv[2])
	: path.resolve('script/data/data_calendar.parquet');

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

const toDateStr = (value: unknown) => {
	const date = value instanceof Date ? value : new Date(String(value ?? ''));
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
};

const toBoolean = (value: unknown) => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'bigint') return value !== 0n;
	if (typeof value === 'number') return value !== 0;

	const normalized = String(value ?? '').trim().toLowerCase();
	if (normalized === '1' || normalized === 'true') return true;
	if (normalized === '0' || normalized === 'false') return false;
	return null;
};

const toInteger = (value: unknown) => {
	if (typeof value === 'bigint') return Number(value);
	const num = Number(value);
	if (!Number.isFinite(num)) return null;
	return Math.trunc(num);
};

const toNumber = (value: unknown) => {
	if (typeof value === 'bigint') return Number(value);
	const num = Number(value);
	if (!Number.isFinite(num)) return null;
	return num;
};

const file = await asyncBufferFromFile(filePath);
const rows = (await parquetReadObjects({ file })) as CalendarParquetRow[];

const calendarRows = rows
	.map((row) => ({
		dateStr: toDateStr(row.__index_level_0__),
		dayAfterHoliday: toBoolean(row.day_after_holiday),
		isHoliday: toBoolean(row.is_holiday),
		holidayStreakLen: toInteger(row.holiday_streak_len),
		daysSinceStreakEnd: toInteger(row.days_since_streak_end),
		postStreakSurge: toNumber(row.post_streak_surge),
		monthSin: toNumber(row.month_sin),
		monthCos: toNumber(row.month_cos)
	}))
	.filter(
		(row): row is {
			dateStr: string;
			dayAfterHoliday: boolean | null;
			isHoliday: boolean | null;
			holidayStreakLen: number | null;
			daysSinceStreakEnd: number | null;
			postStreakSurge: number | null;
			monthSin: number | null;
			monthCos: number | null;
		} => row.dateStr !== null
	);

const pool = new Pool(dbConfig);

try {
	const chunkSize = 1000;
	let upserted = 0;

	for (let i = 0; i < calendarRows.length; i += chunkSize) {
		const batch = calendarRows.slice(i, i + chunkSize);
		const valuesSql = batch
			.map((_, index) => {
				const base = index * 8;
				return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
			})
			.join(', ');

		const params = batch.flatMap((row) => [
			row.dateStr,
			row.dayAfterHoliday,
			row.isHoliday,
			row.holidayStreakLen,
			row.daysSinceStreakEnd,
			row.postStreakSurge,
			row.monthSin,
			row.monthCos
		]);

		await pool.query(
			`INSERT INTO calendar (
				date_str,
				day_after_holiday,
				is_holiday,
				holiday_streak_len,
				days_since_streak_end,
				post_streak_surge,
				month_sin,
				month_cos
			)
			VALUES ${valuesSql}
			ON CONFLICT (date_str) DO UPDATE SET
				day_after_holiday = EXCLUDED.day_after_holiday,
				is_holiday = EXCLUDED.is_holiday,
				holiday_streak_len = EXCLUDED.holiday_streak_len,
				days_since_streak_end = EXCLUDED.days_since_streak_end,
				post_streak_surge = EXCLUDED.post_streak_surge,
				month_sin = EXCLUDED.month_sin,
				month_cos = EXCLUDED.month_cos`,
			params
		);

		upserted += batch.length;
	}

	console.log(`Seeded ${upserted} calendar rows from ${path.basename(filePath)}.`);
} finally {
	await pool.end();
}
