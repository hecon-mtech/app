import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { and, eq, gte } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { inpatientPatients, outpatientPatients, usagePredictionBounds, usages } from '$lib/server/db/schema';

const BASELINE_CUTOFF = '2024-12-07';
const REMOVE_ACTUAL_AND_PATIENT_AFTER = '2024-12-01';
const REMOVE_PREDICTION_AFTER = '2024-12-08';

const toTimestampRange = (dateStr: string, end = false) =>
	new Date(`${dateStr}T${end ? '23:59:59.999' : '00:00:00.000'}`);

export const POST: RequestHandler = async ({ locals }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';

	await drizzleDb.transaction(async (tx) => {
		await tx
			.delete(outpatientPatients)
			.where(
				and(
					eq(outpatientPatients.hospitalId, hospitalId),
					gte(outpatientPatients.visitDate, toTimestampRange(REMOVE_ACTUAL_AND_PATIENT_AFTER))
				)
			);

		await tx
			.delete(inpatientPatients)
			.where(
				and(
					eq(inpatientPatients.hospitalId, hospitalId),
					gte(inpatientPatients.visitDate, toTimestampRange(REMOVE_ACTUAL_AND_PATIENT_AFTER))
				)
			);

		await tx
			.delete(usages)
			.where(
				and(
					eq(usages.hospitalId, hospitalId),
					eq(usages.type, 'actual'),
					gte(usages.dateStr, REMOVE_ACTUAL_AND_PATIENT_AFTER)
				)
			);

		await tx
			.delete(usagePredictionBounds)
			.where(
				and(
					eq(usagePredictionBounds.hospitalId, hospitalId),
					gte(usagePredictionBounds.dateStr, REMOVE_PREDICTION_AFTER)
				)
			);

		await tx
			.delete(usages)
			.where(
				and(
					eq(usages.hospitalId, hospitalId),
					eq(usages.type, 'prediction'),
					gte(usages.dateStr, REMOVE_PREDICTION_AFTER)
				)
			);
	});

	return json({
		message: '데모 데이터가 12/07 기준 상태로 초기화되었습니다.',
		ranges: {
			baselineCutoff: BASELINE_CUTOFF,
			actualAndPatientsRemovedAfter: REMOVE_ACTUAL_AND_PATIENT_AFTER,
			predictionRemovedAfter: REMOVE_PREDICTION_AFTER
		}
	});
};
