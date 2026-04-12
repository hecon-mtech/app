import { integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { drugs } from './catalog';
import { users } from './users';

export const auctionRegInventory = pgTable('auction_reg_inventory', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	drugId: text('drug_id')
		.references(() => drugs.drugCode)
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
