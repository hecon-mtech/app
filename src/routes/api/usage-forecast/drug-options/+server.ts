import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { and, eq, gte, lte } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { currentUsages, supplyPredictions } from '$lib/server/db/schema';

const parseDate = (value: string | null) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const GET: RequestHandler = async ({ url }) => {
	const hospitalId = url.searchParams.get('hospitalId') ?? 'HOSP0001';
	const start = parseDate(url.searchParams.get('start'));
	const end = parseDate(url.searchParams.get('end'));

	if (!start || !end) {
		return json({ message: 'Missing required parameters.' }, { status: 400 });
	}

	const usageRows = await drizzleDb
		.select({ drugId: currentUsages.drugId })
		.from(currentUsages)
		.where(
			and(
				eq(currentUsages.hospitalId, hospitalId),
				gte(currentUsages.timestamp, start),
				lte(currentUsages.timestamp, end)
			)
		);

	const predictionRows = await drizzleDb
		.select({ drugId: supplyPredictions.drugId })
		.from(supplyPredictions)
		.where(
			and(
				eq(supplyPredictions.hospitalId, hospitalId),
				gte(supplyPredictions.time, start),
				lte(supplyPredictions.time, end)
			)
		);

	const ids = Array.from(
		new Set([...usageRows.map((row) => row.drugId), ...predictionRows.map((row) => row.drugId)])
	);

	return json({ drugIds: ids });
};
