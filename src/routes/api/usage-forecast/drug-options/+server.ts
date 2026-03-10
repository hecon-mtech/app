import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { and, eq, gte, lte } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { usages } from '$lib/server/db/schema';

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

export const GET: RequestHandler = async ({ url }) => {
	const hospitalId = url.searchParams.get('hospitalId') ?? 'HOSP0001';
	const start = parseDate(url.searchParams.get('start'));
	const end = parseDate(url.searchParams.get('end'));

	if (!start || !end) {
		return json({ message: 'Missing required parameters.' }, { status: 400 });
	}

	const startStr = toDateStr(start);
	const endStr = toDateStr(end);

	const usageRows = await drizzleDb
		.select({ drugId: usages.drugId })
		.from(usages)
		.where(
			and(
				eq(usages.hospitalId, hospitalId),
				gte(usages.dateStr, startStr),
				lte(usages.dateStr, endStr)
			)
		);

	const ids = Array.from(new Set(usageRows.map((row) => row.drugId)));

	return json({ drugIds: ids });
};
