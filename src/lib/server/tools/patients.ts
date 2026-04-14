import { pullEmsPatientData, summarizeRecentPatients as summarizeRecentPatientsService } from '../services/patients';
import type { HospitalToolContext } from './types';

export const importEmsPatientData = ({ hospitalId }: HospitalToolContext) =>
	pullEmsPatientData(hospitalId);

export const summarizeRecentPatients = (
	{ hospitalId }: HospitalToolContext,
	args?: { start_date?: string; end_date?: string }
) => summarizeRecentPatientsService(hospitalId, args?.start_date, args?.end_date);
