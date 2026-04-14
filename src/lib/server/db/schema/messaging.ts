import { index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { openAiCredentials, users } from './users';

export const messageEntityEnum = pgEnum('message_entity', ['system', 'user', 'assistant']);

export const messageSessions = pgTable(
	'message_session',
	{
		id: serial('id').primaryKey(),
		hospitalId: text('hospital_id')
			.references(() => users.id)
			.notNull(),
		credentialId: integer('credential_id')
			.references(() => openAiCredentials.id)
			.notNull(),
		modelId: text('model_id').notNull(),
		promptCacheKey: text('prompt_cache_key').notNull(),
		sessionName: text('session_name'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		hospitalUpdatedAtIdx: index('message_session_hospital_updated_idx').on(
			table.hospitalId,
			table.updatedAt
		),
		credentialIdx: index('message_session_credential_idx').on(table.credentialId)
	})
);

export const messages = pgTable(
	'messages',
	{
		id: serial('id').primaryKey(),
		sessionId: integer('session_id')
			.references(() => messageSessions.id)
			.notNull(),
		entity: messageEntityEnum('entity').notNull(),
		content: text('content').notNull(),
		payload: jsonb('payload'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => ({
		sessionCreatedAtIdx: index('messages_session_created_idx').on(table.sessionId, table.createdAt)
	})
);

export const sessionSummaries = pgTable(
	'session_summaries',
	{
		id: serial('id').primaryKey(),
		sessionId: integer('session_id')
			.references(() => messageSessions.id)
			.notNull()
			.unique(),
		summary: text('summary').notNull(),
		summarizedUpTo: integer('summarized_up_to').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	}
);
