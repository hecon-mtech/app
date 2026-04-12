import { integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const patientTypeEnum = pgEnum('patient_type', ['inpatient', 'outpatient']);

export const patients = pgTable('patients', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	patientId: integer('patient_id').notNull(),
	visitDate: timestamp('visit_date').notNull(),
	type: patientTypeEnum('type').notNull(),
	sex: integer('sex').notNull(),
	age: integer('age').notNull(),
	primaryDiagnosis: text('primary_diagnosis').notNull(),
	secondaryDiagnosis: text('secondary_diagnosis').notNull(),
	prescription: text('prescription').notNull(),
	department: text('department').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
