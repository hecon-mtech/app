import { getDrugAssociations, searchDrugs } from '../services/drugs';

export const findAssociatedDrugs = (drugId: string) => getDrugAssociations(drugId);

export const searchDrugsTool = (query: string) => searchDrugs(query);
