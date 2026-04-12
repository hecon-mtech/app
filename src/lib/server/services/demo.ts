import { and, eq, gte, inArray } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { auctionBids, auctionRegInventory, inventory, patients } from '$lib/server/db/schema';

const BASELINE_CUTOFF = '2024-12-07';
const REMOVE_ACTUAL_AND_PATIENT_AFTER = '2024-12-01';
const REMOVE_PREDICTION_AFTER = '2024-12-08';
const REMOVE_AUCTION_AFTER = '2024-12-08';

const toTimestampRange = (dateStr: string, end = false) =>
	new Date(`${dateStr}T${end ? '23:59:59.999' : '00:00:00.000'}`);

export const resetDemoData = async (hospitalId: string) => {
	await drizzleDb.transaction(async (tx) => {
		const ordersToRemove = await tx
			.select({ id: auctionRegInventory.id })
			.from(auctionRegInventory)
			.where(
				and(
					eq(auctionRegInventory.hospitalId, hospitalId),
					gte(auctionRegInventory.createdAt, toTimestampRange(REMOVE_AUCTION_AFTER))
				)
			);

		const orderIdsToRemove = ordersToRemove.map((row) => row.id);

		if (orderIdsToRemove.length > 0) {
			await tx.delete(auctionBids).where(inArray(auctionBids.regInventoryId, orderIdsToRemove));
		}

		await tx
			.delete(auctionRegInventory)
			.where(
				and(
					eq(auctionRegInventory.hospitalId, hospitalId),
					gte(auctionRegInventory.createdAt, toTimestampRange(REMOVE_AUCTION_AFTER))
				)
			);

		await tx
			.delete(patients)
			.where(
				and(
					eq(patients.hospitalId, hospitalId),
					gte(patients.visitDate, toTimestampRange(REMOVE_ACTUAL_AND_PATIENT_AFTER))
				)
			);

		await tx
			.delete(inventory)
			.where(
				and(
					eq(inventory.hospitalId, hospitalId),
					eq(inventory.type, 'actual'),
					gte(inventory.dateStr, REMOVE_ACTUAL_AND_PATIENT_AFTER)
				)
			);

		await tx
			.delete(inventory)
			.where(
				and(
					eq(inventory.hospitalId, hospitalId),
					inArray(inventory.type, ['prediction', 'prediction_upper', 'prediction_lower']),
					gte(inventory.dateStr, REMOVE_PREDICTION_AFTER)
				)
			);
	});

	return {
		message: '데모 데이터가 12/07 기준 상태로 초기화되었습니다.',
		ranges: {
			baselineCutoff: BASELINE_CUTOFF,
			actualAndPatientsRemovedAfter: REMOVE_ACTUAL_AND_PATIENT_AFTER,
			predictionRemovedAfter: REMOVE_PREDICTION_AFTER,
			auctionRemovedAfter: REMOVE_AUCTION_AFTER
		}
	};
};
