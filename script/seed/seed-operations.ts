import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
	atcCodes,
	auctionBids,
	auctionRegInventory,
	configurations,
	inventory,
	usages,
	users
} from '../../src/lib/server/db/schema';

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

const TARGET_HOSPITAL_ID = 'HOSP0001';
const START_DATE_STR = '2024-12-01';
const END_DATE_STR = '2024-12-07';
const now = new Date();

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const toNumeric = (value: number) => value.toFixed(2);
const toDateStr = (value: Date) => {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};
const parseDate = (value: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid date: ${value}`);
	}
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const eachDate = (startStr: string, endStr: string) => {
	const dates: string[] = [];
	const cursor = parseDate(startStr);
	const end = parseDate(endStr);
	while (cursor <= end) {
		dates.push(toDateStr(cursor));
		cursor.setDate(cursor.getDate() + 1);
	}
	return dates;
};
const pickN = <T>(rows: T[], count: number) => {
	const copied = [...rows];
	for (let i = copied.length - 1; i > 0; i -= 1) {
		const j = randomInt(0, i);
		[copied[i], copied[j]] = [copied[j], copied[i]];
	}
	return copied.slice(0, Math.max(0, Math.min(count, copied.length)));
};

const requestedHospital = process.env.SEED_HOSPITAL_ID?.trim();
if (requestedHospital && requestedHospital !== TARGET_HOSPITAL_ID) {
	throw new Error(`seed:operations only supports ${TARGET_HOSPITAL_ID} for dev mode.`);
}

await db.delete(auctionBids);
await db.delete(auctionRegInventory);
await db.delete(configurations);
await db.delete(inventory);

const [targetHospital] = await db
	.select({ id: users.id })
	.from(users)
	.where(eq(users.id, TARGET_HOSPITAL_ID))
	.limit(1);

if (!targetHospital) {
	throw new Error(`Target hospital ${TARGET_HOSPITAL_ID} not found. Run seed:users first.`);
}

const supplierRows = await db
	.select({ id: users.id })
	.from(users)
	.where(eq(users.description, 'supplier'));

if (supplierRows.length === 0) {
	throw new Error('No supplier users found. Seed users first.');
}

const usageTopRows = await db
	.select({
		drugId: usages.drugId,
		totalUsage: sql<string>`sum(${usages.quantity})`
	})
	.from(usages)
	.where(
		and(
			eq(usages.hospitalId, TARGET_HOSPITAL_ID),
			eq(usages.type, 'actual'),
			gte(usages.dateStr, START_DATE_STR),
			lte(usages.dateStr, END_DATE_STR)
		)
	)
	.groupBy(usages.drugId)
	.orderBy(desc(sql`sum(${usages.quantity})`));

const fallbackDrugs = await db.select({ id: atcCodes.id }).from(atcCodes).limit(120);
const targetDrugIds = Array.from(
	new Set([...usageTopRows.map((row) => row.drugId), ...fallbackDrugs.map((row) => row.id)])
).slice(0, 30);

const dateStrs = eachDate(START_DATE_STR, END_DATE_STR);

const usageDailyRows = await db
	.select({
		drugId: usages.drugId,
		dateStr: usages.dateStr,
		totalUsage: sql<string>`sum(${usages.quantity})`
	})
	.from(usages)
	.where(
		and(
			eq(usages.hospitalId, TARGET_HOSPITAL_ID),
			eq(usages.type, 'actual'),
			gte(usages.dateStr, START_DATE_STR),
			lte(usages.dateStr, END_DATE_STR)
		)
	)
	.groupBy(usages.drugId, usages.dateStr);

const usageByDrugDate = new Map<string, number>();
const usageTotalByDrug = new Map<string, number>();
for (const row of usageDailyRows) {
	const qty = Number(row.totalUsage);
	usageByDrugDate.set(`${row.drugId}::${row.dateStr}`, qty);
	usageTotalByDrug.set(row.drugId, (usageTotalByDrug.get(row.drugId) ?? 0) + qty);
}

const threshold = randomInt(12, 30);
await db.insert(configurations).values([
	{
		hospitalId: TARGET_HOSPITAL_ID,
		configId: 'reorder_threshold',
		configDesc: 'Inventory reorder threshold',
		configValue: String(threshold),
		configValueType: 'number',
		createdAt: now,
		updatedAt: now
	},
	{
		hospitalId: TARGET_HOSPITAL_ID,
		configId: 'auction_enabled',
		configDesc: 'Whether auction order is enabled',
		configValue: 'true',
		configValueType: 'boolean',
		createdAt: now,
		updatedAt: now
	},
	{
		hospitalId: TARGET_HOSPITAL_ID,
		configId: 'default_lead_time_days',
		configDesc: 'Supplier lead time in days',
		configValue: String(randomInt(3, 10)),
		configValueType: 'number',
		createdAt: now,
		updatedAt: now
	}
]);

const inventoryRows: typeof inventory.$inferInsert[] = [];

for (const drugId of targetDrugIds) {
	const usageTotal = usageTotalByDrug.get(drugId) ?? 0;
	const estimatedDaily = Math.max(0.5, usageTotal > 0 ? usageTotal / dateStrs.length : randomInt(1, 4));
	const reorderFloor = estimatedDaily * 3;
	const maxCap = estimatedDaily * 21;
	let runningStock = Math.round(estimatedDaily * randomInt(7, 14));

	for (let index = 0; index < dateStrs.length; index += 1) {
		const dateStr = dateStrs[index];
		const usedQty =
			usageByDrugDate.get(`${drugId}::${dateStr}`) ??
			randomInt(0, Math.max(1, Math.round(estimatedDaily * 1.2)));

		if (index > 0 && runningStock < reorderFloor) {
			runningStock += Math.round(estimatedDaily * randomInt(7, 10));
		}

		runningStock = Math.max(0, runningStock - Math.round(usedQty));
		runningStock = Math.min(runningStock, Math.round(maxCap));

		inventoryRows.push({
			hospitalId: TARGET_HOSPITAL_ID,
			drugId,
			dateStr,
			quantity: toNumeric(runningStock),
			isReal: Math.random() < 0.2,
			createdAt: now,
			updatedAt: now
		});
	}
}

if (inventoryRows.length > 0) {
	await db.insert(inventory).values(inventoryRows);
}

const latestDate = dateStrs[dateStrs.length - 1];
const latestInventoryRows = inventoryRows.filter((row) => row.dateStr === latestDate);
const auctionCandidates = pickN(latestInventoryRows, 8);

for (const row of auctionCandidates) {
	const auctionQty = Math.max(1, Math.round(Number(row.quantity) * 1.5));
	const expireAt = new Date(`${latestDate}T00:00:00.000Z`);
	expireAt.setDate(expireAt.getDate() + randomInt(4, 20));

	const [inserted] = await db
		.insert(auctionRegInventory)
		.values({
			hospitalId: row.hospitalId,
			drugId: row.drugId,
			quantity: toNumeric(auctionQty),
			expireAt,
			createdAt: now,
			updatedAt: now
		})
		.returning({ id: auctionRegInventory.id });

	const bidders = pickN(supplierRows, randomInt(1, Math.min(3, supplierRows.length)));
	const basePrice = randomInt(12, 80);

	if (bidders.length > 0) {
		await db.insert(auctionBids).values(
			bidders.map((bidder, index) => ({
				regInventoryId: inserted.id,
				userId: bidder.id,
				price: toNumeric(basePrice + index * randomInt(1, 5) + Math.random()),
				createdAt: now,
				updatedAt: now
			}))
		);
	}
}

await pool.end();

console.log(
	`Seeded daily inventory snapshots for ${TARGET_HOSPITAL_ID} (${START_DATE_STR}..${END_DATE_STR}), rows=${inventoryRows.length}.`
);
