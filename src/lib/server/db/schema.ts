import { date, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const drugs = pgTable('drugs', {
	fdaClass: text('fda_class').notNull(),
	ingredientCode: text('ingredient_code').notNull(),
	drugCode: text('drug_code').primaryKey(),
	drugName: text('drug_name').notNull(),
	manufactor: text('manufactor').notNull(),
	atcCode: text('atc_code').notNull(),
	atcName: text('atc_name').notNull(),
	atc5: text('atc_5')
		.references(() => atcCodes.id)
		.notNull()
});

export const atcCodes = pgTable('atc_codes', {
	id: text('id').primaryKey(),
	name: text('name').notNull()
});

export const hospitals = pgTable('hospitals', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	password: text('password').notNull()
});

export const currentUsages = pgTable('current_usages', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => hospitals.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	quantity: numeric('quantity').notNull(),
	timestamp: date('timestamp', { mode: 'date' }).notNull()
});

export const supplyPredictions = pgTable('supply_predictions', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => hospitals.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	quantity: numeric('quantity').notNull(),
	upper: numeric('upper').notNull(),
	lower: numeric('lower').notNull(),
	time: date('time', { mode: 'date' }).notNull(),
	model: text('model').notNull()
});

export const stockBalances = pgTable('stock_balances', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => hospitals.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	onHand: numeric('on_hand').notNull(),
	reserved: numeric('reserved').notNull(),
	reorderPoint: numeric('reorder_point').notNull(),
	reorderQty: numeric('reorder_qty').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});

export const stockMovements = pgTable('stock_movements', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => hospitals.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	movementType: text('movement_type').notNull(),
	quantity: numeric('quantity').notNull(),
	refType: text('ref_type'),
	refId: text('ref_id'),
	note: text('note'),
	occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull()
});

export const purchaseOrders = pgTable('purchase_orders', {
	id: text('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => hospitals.id)
		.notNull(),
	supplierName: text('supplier_name').notNull(),
	status: text('status').notNull(),
	orderedAt: timestamp('ordered_at', { withTimezone: true }),
	expectedAt: timestamp('expected_at', { withTimezone: true }),
	note: text('note')
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
	id: serial('id').primaryKey(),
	poId: text('po_id')
		.references(() => purchaseOrders.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	orderedQty: numeric('ordered_qty').notNull(),
	receivedQty: numeric('received_qty').notNull(),
	unitPrice: numeric('unit_price')
});

export const goodsReceipts = pgTable('goods_receipts', {
	id: text('id').primaryKey(),
	poId: text('po_id').references(() => purchaseOrders.id),
	hospitalId: text('hospital_id')
		.references(() => hospitals.id)
		.notNull(),
	receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
	status: text('status').notNull()
});

export const goodsReceiptItems = pgTable('goods_receipt_items', {
	id: serial('id').primaryKey(),
	grnId: text('grn_id')
		.references(() => goodsReceipts.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	quantity: numeric('quantity').notNull()
});

export const outpatientPatients = pgTable('outpatient_patients', {
	id: serial('id').primaryKey(),
	patientId: integer('patient_id').notNull(),
	visitDate: timestamp('visit_date').notNull(),
	sex: integer('sex').notNull(),
	age: integer('age').notNull(),
	primaryDiagnosis: text('primary_diagnosis').notNull(),
	secondaryDiagnosis: text('secondary_diagnosis').notNull(),
	prescription: text('prescription').notNull(),
	department: text('department').notNull()
});

export const inpatientPatients = pgTable('inpatient_patients', {
	id: serial('id').primaryKey(),
	patientId: integer('patient_id').notNull(),
	visitDate: timestamp('visit_date').notNull(),
	sex: integer('sex').notNull(),
	age: integer('age').notNull(),
	primaryDiagnosis: text('primary_diagnosis').notNull(),
	secondaryDiagnosis: text('secondary_diagnosis').notNull(),
	prescription: text('prescription').notNull(),
	department: text('department').notNull()
});
