import { numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { drugs } from './catalog';
import { users } from './users';

export const flowTypeEnum = pgEnum('flow_type', ['prediction', 'actual', 'prediction_upper', 'prediction_lower']);

export const inventory = pgTable(
	'inventory',
	{
		id: serial('id').primaryKey(),
		hospitalId: text('hospital_id')
			.references(() => users.id)
			.notNull(),
		dateStr: text('date_str').notNull(),
		drugId: text('drug_id')
			.references(() => drugs.drugCode)
			.notNull(),
		flow: numeric('quantity').notNull(),
		type: flowTypeEnum('type_').notNull(),
		stock: numeric('stock').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		logicalRowUidx: uniqueIndex('inventory_hospital_date_drug_type_uidx').on(
			table.hospitalId,
			table.dateStr,
			table.drugId,
			table.type
		)
	})
);

export const configValueTypeEnum = pgEnum('config_value_type', ['string', 'number', 'boolean']);

export const configurations = pgTable(
	'configurations',
	{
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
	},
	(table) => ({
		hospitalConfigUidx: uniqueIndex('configurations_hospital_config_uidx').on(
			table.hospitalId,
			table.configId
		)
	})
);
