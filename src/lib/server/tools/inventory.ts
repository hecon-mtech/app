import { summarizeInventory } from '../services/inventory-summary';
import type { HospitalToolContext } from './types';

export const summarizeInventoryTool = (
	{ hospitalId }: HospitalToolContext,
	args?: { start_date?: string; end_date?: string }
) => summarizeInventory(hospitalId, args?.start_date, args?.end_date);
