import {
	boolean,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp
} from 'drizzle-orm/pg-core';

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

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	password: text('password').notNull(),
	description: text('description').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const usageTypeEnum = pgEnum('usage_type', ['prediction', 'actual']);

export const usages = pgTable('usages', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	quantity: numeric('quantity').notNull(),
	type: usageTypeEnum('type_').notNull(),
	dateStr: text('date_str').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const usagePredictionBounds = pgTable(
	'usage_prediction_bounds',
	{
		id: serial('id').primaryKey(),
		hospitalId: text('hospital_id')
			.references(() => users.id)
			.notNull(),
		drugId: text('drug_id')
			.references(() => atcCodes.id)
			.notNull(),
		dateStr: text('date_str').notNull(),
		upper: numeric('upper').notNull(),
		lower: numeric('lower').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		usagePredictionBoundsHospitalDrugDateIdx: index('usage_pred_bounds_hospital_drug_date_idx').on(
			table.hospitalId,
			table.drugId,
			table.dateStr
		)
	})
);

export const inventory = pgTable(
	'inventory',
	{
		id: serial('id').primaryKey(),
		hospitalId: text('hospital_id')
			.references(() => users.id)
			.notNull(),
		drugId: text('drug_id')
			.references(() => atcCodes.id)
			.notNull(),
		dateStr: text('date_str').notNull(),
		quantity: numeric('quantity').notNull(),
		isReal: boolean('is_real').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		inventoryHospitalDrugDateIdx: index('inventory_hospital_drug_date_idx').on(
			table.hospitalId,
			table.drugId,
			table.dateStr
		)
	})
);

export const configValueTypeEnum = pgEnum('config_value_type', ['string', 'number', 'boolean']);

export const configurations = pgTable('configurations', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	configId: text('config_id').notNull(),
	configDesc: text('config_desc').notNull(),
	configValue: text('config_value').notNull(),
	configValueType: configValueTypeEnum('config_value_type').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const auctionRegInventory = pgTable('auction_reg_inventory', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => atcCodes.id)
		.notNull(),
	quantity: numeric('quantity').notNull(),
	expireAt: timestamp('expire_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const auctionBids = pgTable('auction_bids', {
	id: serial('id').primaryKey(),
	regInventoryId: integer('reg_inventory_id')
		.references(() => auctionRegInventory.id)
		.notNull(),
	userId: text('user_id')
		.references(() => users.id)
		.notNull(),
	price: numeric('price').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const outpatientPatients = pgTable('outpatient_patients', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	patientId: integer('patient_id').notNull(),
	visitDate: timestamp('visit_date').notNull(),
	sex: integer('sex').notNull(),
	age: integer('age').notNull(),
	primaryDiagnosis: text('primary_diagnosis').notNull(),
	secondaryDiagnosis: text('secondary_diagnosis').notNull(),
	prescription: text('prescription').notNull(),
	department: text('department').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const inpatientPatients = pgTable('inpatient_patients', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	patientId: integer('patient_id').notNull(),
	visitDate: timestamp('visit_date').notNull(),
	sex: integer('sex').notNull(),
	age: integer('age').notNull(),
	primaryDiagnosis: text('primary_diagnosis').notNull(),
	secondaryDiagnosis: text('secondary_diagnosis').notNull(),
	prescription: text('prescription').notNull(),
	department: text('department').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
