import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { and, eq, gte, lte } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { usagePredictionBounds, usages } from '$lib/server/db/schema';

const toDateKey = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const parseDate = (value: string | null) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toDateStr = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const getDateRange = (start: Date, end: Date) => {
	const days: Date[] = [];
	const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	while (cursor <= end) {
		days.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
		cursor.setDate(cursor.getDate() + 1);
	}
	return days;
};

export const GET: RequestHandler = async ({ url }) => {
	const hospitalId = url.searchParams.get('hospitalId') ?? 'HOSP0001';
	const drugId = url.searchParams.get('drugId');
	const start = parseDate(url.searchParams.get('start'));
	const end = parseDate(url.searchParams.get('end'));
	const actualEnd = parseDate(url.searchParams.get('actualEnd'));

	if (!drugId || !start || !end) {
		return json({ message: 'Missing required parameters.' }, { status: 400 });
	}

	const labels = getDateRange(start, end).map(toDateKey);
	const actualMap = new Map<string, number>();
	const predictionMap = new Map<string, number>();
	const predictionBoundsMap = new Map<string, { upper: number; lower: number }>();
	const startStr = toDateStr(start);
	const endStr = toDateStr(end);
	const actualEndStr = actualEnd ? toDateStr(actualEnd) : null;

	if (actualEnd && actualEnd >= start && actualEndStr) {
		const usageRows = await drizzleDb
			.select({ date: usages.dateStr, quantity: usages.quantity })
			.from(usages)
			.where(
				and(
					eq(usages.hospitalId, hospitalId),
					eq(usages.drugId, drugId),
					eq(usages.type, 'actual'),
					gte(usages.dateStr, startStr),
					lte(usages.dateStr, actualEndStr)
				)
			);

		for (const row of usageRows) {
			const dateKey = row.date;
			actualMap.set(dateKey, Number(row.quantity));
		}
	}

	const predictionRows = await drizzleDb
		.select({ date: usages.dateStr, quantity: usages.quantity })
		.from(usages)
		.where(
			and(
				eq(usages.hospitalId, hospitalId),
				eq(usages.drugId, drugId),
				eq(usages.type, 'prediction'),
				gte(usages.dateStr, startStr),
				lte(usages.dateStr, endStr)
			)
		);

	for (const row of predictionRows) {
		predictionMap.set(row.date, Number(row.quantity));
	}

	const predictionBoundsRows = await drizzleDb
		.select({
			date: usagePredictionBounds.dateStr,
			upper: usagePredictionBounds.upper,
			lower: usagePredictionBounds.lower
		})
		.from(usagePredictionBounds)
		.where(
			and(
				eq(usagePredictionBounds.hospitalId, hospitalId),
				eq(usagePredictionBounds.drugId, drugId),
				gte(usagePredictionBounds.dateStr, startStr),
				lte(usagePredictionBounds.dateStr, endStr)
			)
		);

	for (const row of predictionBoundsRows) {
		predictionBoundsMap.set(row.date, {
			upper: Number(row.upper),
			lower: Math.max(0, Number(row.lower))
		});
	}

	const actual = labels.map((label) => actualMap.get(label) ?? null);
	const prediction = labels.map((label) => predictionMap.get(label) ?? null);
	const upper = labels.map((label) => predictionBoundsMap.get(label)?.upper ?? null);
	const lower = labels.map((label) => predictionBoundsMap.get(label)?.lower ?? null);

	return json({
		labels,
		actual,
		prediction,
		upper,
		lower
	});
};
