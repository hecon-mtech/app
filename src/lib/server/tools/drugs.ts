import { getDrugAssociations } from '../services/drugs';

export const findAssociatedDrugs = (drugId: string) => getDrugAssociations(drugId);
