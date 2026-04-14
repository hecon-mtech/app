import { summarizeRecentInventory, inventoryPrediction, suggestOrder } from '../services/inventory-summary';
import type { HospitalToolContext } from './types';

export const summarizeRecentInventoryTool = (
	{ hospitalId }: HospitalToolContext,
	args?: { start_date?: string; end_date?: string }
) => summarizeRecentInventory(hospitalId, args?.start_date, args?.end_date);

export const inventoryPredictionTool = (
	{ hospitalId }: HospitalToolContext,
	args: { drug_code: string; prediction_start_date?: string }
) => inventoryPrediction(hospitalId, args.drug_code, args.prediction_start_date);

export const suggestOrderTool = (
	{ hospitalId }: HospitalToolContext,
	args?: { drug_id?: string }
) => suggestOrder(hospitalId, args?.drug_id);
