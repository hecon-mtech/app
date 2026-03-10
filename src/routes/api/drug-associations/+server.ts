import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { drizzleDb } from '$lib/server/db';
import { drugs } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ url }) => {
	const drugId = url.searchParams.get('drugId')?.trim();

	if (!drugId) {
		return json({ message: 'Missing required parameter: drugId.' }, { status: 400 });
	}

	const rows = await drizzleDb
		.select({
			drugCode: drugs.drugCode,
			drugName: drugs.drugName,
			manufactor: drugs.manufactor,
			atcCode: drugs.atcCode
		})
		.from(drugs)
		.where(eq(drugs.atc5, drugId))
		.orderBy(asc(drugs.drugName));

	return json({
		drugId,
		items: rows
	});
};
