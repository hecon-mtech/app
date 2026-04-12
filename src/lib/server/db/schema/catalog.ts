import { numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const drugs = pgTable('drugs', {
	fdaClass: text('fda_class').notNull(),
	ingredientCode: text('ingredient_code').notNull(),
	drugCode: text('drug_code').primaryKey(),
	drugName: text('drug_name').notNull(),
	manufactor: text('manufactor').notNull(),
	atcCode: text('atc_code').notNull(),
	atcName: text('atc_name').notNull()
});

export const drugPrices = pgTable('drugs_price', {
	drugCode: text('drug_code')
		.references(() => drugs.drugCode)
		.notNull(),
	price: numeric('price').notNull(),
	source: text('source'),
	sourceUrl: text('source_url'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
