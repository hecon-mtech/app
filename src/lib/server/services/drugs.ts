import { getAssociatedDrugsByDrugCode } from '$lib/server/db/drug-groups';
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
