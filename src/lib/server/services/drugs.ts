import { or, ilike } from 'drizzle-orm';
import { getAssociatedDrugsByDrugCode } from '$lib/server/db/drug-groups';
import { drizzleDb } from '$lib/server/db';
import { drugs } from '$lib/server/db/schema/catalog';
import { ServiceError } from './errors';

export const getDrugAssociations = async (drugId: string | null | undefined) => {
	const normalizedDrugId = drugId?.trim() ?? '';

	if (!normalizedDrugId) {
		throw new ServiceError(400, 'Missing required parameter: drugId.');
	}

	const items = await getAssociatedDrugsByDrugCode(normalizedDrugId);

	return {
		drugId: normalizedDrugId,
		items
	};
};

export const searchDrugs = async (query: string) => {
	const trimmed = query.trim();
	if (!trimmed) {
		throw new ServiceError(400, '검색어를 입력해주세요.');
	}

	const pattern = `%${trimmed}%`;
	const rows = await drizzleDb
		.select({
			drugCode: drugs.drugCode,
			drugName: drugs.drugName,
			fdaClass: drugs.fdaClass,
			ingredientCode: drugs.ingredientCode,
			manufactor: drugs.manufactor,
			atcCode: drugs.atcCode,
			atcName: drugs.atcName
		})
		.from(drugs)
		.where(
			or(
				ilike(drugs.drugCode, pattern),
				ilike(drugs.drugName, pattern),
				ilike(drugs.fdaClass, pattern),
				ilike(drugs.ingredientCode, pattern),
				ilike(drugs.manufactor, pattern),
				ilike(drugs.atcCode, pattern),
				ilike(drugs.atcName, pattern)
			)
		)
		.limit(50);

	return {
		query: trimmed,
		count: rows.length,
		columns: ['drugCode', 'drugName', 'fdaClass', 'ingredientCode', 'manufactor', 'atcCode', 'atcName'],
		rows
	};
};
