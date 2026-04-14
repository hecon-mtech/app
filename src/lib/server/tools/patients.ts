import { pullEmsPatientData, summarizeRecentPatients as summarizeRecentPatientsService } from '../services/patients';
import type { HospitalToolContext } from './types';

export const importEmsPatientData = ({ hospitalId }: HospitalToolContext) =>
	pullEmsPatientData(hospitalId);

export const summarizeRecentPatients = ({ hospitalId }: HospitalToolContext) =>
	summarizeRecentPatientsService(hospitalId);
