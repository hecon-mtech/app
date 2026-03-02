import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { desc, eq, sql } from 'drizzle-orm';
import {
	atcCodes,
	currentUsages,
	goodsReceiptItems,
	goodsReceipts,
	hospitals,
	purchaseOrderItems,
	purchaseOrders,
	stockBalances,
	stockMovements
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

const seedHospitalId = process.env.SEED_HOSPITAL_ID;
const supportedHospitalIds = ['HOSP0001', 'HOSP0002'];
const now = new Date();

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const randomFrom = <T>(arr: T[]) => arr[randomInt(0, arr.length - 1)];

const shuffle = <T>(arr: T[]) => {
	const copied = [...arr];
	for (let i = copied.length - 1; i > 0; i -= 1) {
		const j = randomInt(0, i);
		[copied[i], copied[j]] = [copied[j], copied[i]];
	}
	return copied;
};

const daysAgo = (days: number) => {
	const date = new Date(now);
	date.setDate(date.getDate() - days);
	return date;
};

const toNumeric = (value: number) => value.toFixed(2);

const movementTotals = new Map<string, number>();
const keyOf = (hospitalId: string, drugId: string) => `${hospitalId}::${drugId}`;
const addMovementTotal = (hospitalId: string, drugId: string, qty: number) => {
	const key = keyOf(hospitalId, drugId);
	movementTotals.set(key, (movementTotals.get(key) ?? 0) + qty);
};

if (seedHospitalId && !supportedHospitalIds.includes(seedHospitalId)) {
	throw new Error(`SEED_HOSPITAL_ID must be one of: ${supportedHospitalIds.join(', ')}`);
}

const allHospitals = await db.select({ id: hospitals.id }).from(hospitals);
const allowedHospitals = allHospitals.filter((hospital) => supportedHospitalIds.includes(hospital.id));
const targetHospitals = seedHospitalId
	? allowedHospitals.filter((hospital) => hospital.id === seedHospitalId)
	: allowedHospitals;

if (targetHospitals.length === 0) {
	throw new Error(
		`No supported hospitals found. Run seed:hospitals and ensure one of: ${supportedHospitalIds.join(', ')}`
	);
}

const allDrugRows = await db.select({ id: atcCodes.id }).from(atcCodes);
if (allDrugRows.length === 0) {
	throw new Error('No ATC codes found. Seed atc_codes first.');
}

await db.delete(goodsReceiptItems);
await db.delete(goodsReceipts);
await db.delete(purchaseOrderItems);
await db.delete(purchaseOrders);
await db.delete(stockMovements);
await db.delete(stockBalances);

const suppliers = ['동아메디', '한빛약품', '세움헬스케어', '온누리메드', '에버케어'];
const poStatuses = ['approved', 'ordered', 'partially_received', 'received', 'cancelled'];

const stockMovementRows: typeof stockMovements.$inferInsert[] = [];
const stockBalanceRows: typeof stockBalances.$inferInsert[] = [];
const purchaseOrderRows: typeof purchaseOrders.$inferInsert[] = [];
const purchaseOrderItemRows: typeof purchaseOrderItems.$inferInsert[] = [];
const goodsReceiptRows: typeof goodsReceipts.$inferInsert[] = [];
const goodsReceiptItemRows: typeof goodsReceiptItems.$inferInsert[] = [];

let poCounter = 1;
let grnCounter = 1;

for (const hospital of targetHospitals) {
	const usageRows = await db
		.select({
			drugId: currentUsages.drugId,
			total: sql<string>`sum(${currentUsages.quantity})`
		})
		.from(currentUsages)
		.where(eq(currentUsages.hospitalId, hospital.id))
		.groupBy(currentUsages.drugId)
		.orderBy(desc(sql`sum(${currentUsages.quantity})`));

	const usageDrugIds = usageRows.map((row) => row.drugId);
	const fallbackDrugIds = shuffle(allDrugRows.map((row) => row.id));
	const hospitalDrugIds = Array.from(new Set([...usageDrugIds, ...fallbackDrugIds])).slice(0, 28);

	for (const drugId of hospitalDrugIds) {
		const openingQty = randomInt(120, 320);
		stockMovementRows.push({
			hospitalId: hospital.id,
			drugId,
			movementType: 'adjustment',
			quantity: toNumeric(openingQty),
			refType: 'opening_balance',
			refId: `OPEN-${hospital.id}`,
			note: 'Seed opening stock',
			occurredAt: daysAgo(45)
		});
		addMovementTotal(hospital.id, drugId, openingQty);

		const usageEvents = randomInt(6, 14);
		for (let i = 0; i < usageEvents; i += 1) {
			const usageQty = randomInt(4, 22);
			stockMovementRows.push({
				hospitalId: hospital.id,
				drugId,
				movementType: 'usage',
				quantity: toNumeric(-usageQty),
				refType: 'usage',
				refId: `USE-${hospital.id}-${drugId}-${i + 1}`,
				note: 'Daily dispensing',
				occurredAt: daysAgo(randomInt(1, 30))
			});
			addMovementTotal(hospital.id, drugId, -usageQty);
		}
	}

	const poCount = 12;
	for (let poIndex = 0; poIndex < poCount; poIndex += 1) {
		const poId = `PO-${hospital.id}-${String(poCounter).padStart(4, '0')}`;
		poCounter += 1;
		const status = randomFrom(poStatuses);
		const orderedAt = daysAgo(randomInt(2, 25));
		const expectedAt = daysAgo(randomInt(-10, 4));

		purchaseOrderRows.push({
			id: poId,
			hospitalId: hospital.id,
			supplierName: randomFrom(suppliers),
			status,
			orderedAt,
			expectedAt,
			note: status === 'cancelled' ? 'Cancelled due to schedule change' : null
		});

		const itemDrugIds = shuffle(hospitalDrugIds).slice(0, randomInt(3, 6));
		const receiptId = `GRN-${hospital.id}-${String(grnCounter).padStart(4, '0')}`;
		let hasReceipt = false;

		for (const itemDrugId of itemDrugIds) {
			const orderedQty = randomInt(40, 180);
			let receivedQty = 0;

			if (status === 'received') {
				receivedQty = orderedQty;
			}
			if (status === 'partially_received') {
				receivedQty = randomInt(Math.ceil(orderedQty * 0.35), Math.ceil(orderedQty * 0.8));
			}

			purchaseOrderItemRows.push({
				poId,
				drugId: itemDrugId,
				orderedQty: toNumeric(orderedQty),
				receivedQty: toNumeric(receivedQty),
				unitPrice: toNumeric(randomInt(12, 90) + Math.random())
			});

			if (receivedQty > 0) {
				hasReceipt = true;
				goodsReceiptItemRows.push({
					grnId: receiptId,
					drugId: itemDrugId,
					quantity: toNumeric(receivedQty)
				});
				stockMovementRows.push({
					hospitalId: hospital.id,
					drugId: itemDrugId,
					movementType: 'receipt',
					quantity: toNumeric(receivedQty),
					refType: 'grn',
					refId: receiptId,
					note: `Receipt from ${poId}`,
					occurredAt: daysAgo(randomInt(0, 12))
				});
				addMovementTotal(hospital.id, itemDrugId, receivedQty);
			}
		}

		if (hasReceipt) {
			goodsReceiptRows.push({
				id: receiptId,
				poId,
				hospitalId: hospital.id,
				receivedAt: daysAgo(randomInt(0, 12)),
				status: 'posted'
			});
			grnCounter += 1;
		}
	}

	const priorityIds = hospitalDrugIds.slice(0, 10);
	for (const drugId of hospitalDrugIds) {
		const netQty = movementTotals.get(keyOf(hospital.id, drugId)) ?? 0;
		let onHand = Math.max(0, netQty);
		const reorderPoint = priorityIds.includes(drugId) ? randomInt(90, 180) : randomInt(30, 100);
		if (priorityIds.includes(drugId)) {
			onHand = Math.min(onHand, randomInt(0, Math.max(0, reorderPoint - 5)));
		}
		const reserved = Math.min(randomInt(0, 20), Math.floor(onHand * 0.35));
		const reorderQty = randomInt(80, 220);

		stockBalanceRows.push({
			hospitalId: hospital.id,
			drugId,
			onHand: toNumeric(onHand),
			reserved: toNumeric(reserved),
			reorderPoint: toNumeric(reorderPoint),
			reorderQty: toNumeric(reorderQty),
			updatedAt: now
		});
	}
}

if (purchaseOrderRows.length > 0) {
	await db.insert(purchaseOrders).values(purchaseOrderRows);
}
if (purchaseOrderItemRows.length > 0) {
	await db.insert(purchaseOrderItems).values(purchaseOrderItemRows);
}
if (goodsReceiptRows.length > 0) {
	await db.insert(goodsReceipts).values(goodsReceiptRows);
}
if (goodsReceiptItemRows.length > 0) {
	await db.insert(goodsReceiptItems).values(goodsReceiptItemRows);
}
if (stockMovementRows.length > 0) {
	await db.insert(stockMovements).values(stockMovementRows);
}
if (stockBalanceRows.length > 0) {
	await db.insert(stockBalances).values(stockBalanceRows);
}

await pool.end();

console.log(
	`Seeded operations flow data: ${purchaseOrderRows.length} POs, ${goodsReceiptRows.length} GRNs, ${stockBalanceRows.length} stock balances.`
);
