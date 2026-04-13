import { boolean, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const patientTypeEnum = pgEnum('patient_type', ['inpatient', 'outpatient']);
export const patientSexEnum = pgEnum('patient_sex', ['male', 'female', 'unknown']);

export const patients = pgTable('patients', {
	id: serial('id').primaryKey(),
	hospitalId: text('hospital_id')
		.references(() => users.id)
		.notNull(),
	patientId: integer('patient_id').notNull(),
	visitDateStr: text('visit_date_str').notNull(),
	type: patientTypeEnum('type').notNull(),
	sex: patientSexEnum('sex').notNull(),
	age: integer('age').notNull(),
	diagnosisCode: text('diagnosis_code').notNull(), // KCD code
	isPrimaryDiagnosis: boolean('is_primary_diagnosis').notNull(),
	departmentStr: text('department_str').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
