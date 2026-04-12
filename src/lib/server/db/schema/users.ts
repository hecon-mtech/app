import { index, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	password: text('password').notNull(),
	description: text('description').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const openAiCredentials = pgTable(
	'open_ai_credentials',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.references(() => users.id)
			.notNull(),
		oauth: jsonb('oauth'),
		apiKey: text('api_key'),
		name: text('name').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		userIdx: index('open_ai_credentials_user_idx').on(table.userId),
		userNameUidx: uniqueIndex('open_ai_credentials_user_name_uidx').on(table.userId, table.name)
	})
);
