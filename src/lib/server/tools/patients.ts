import { pullEmsPatientData } from '../services/patients';
import type { HospitalToolContext } from './types';

export const importEmsPatientData = ({ hospitalId }: HospitalToolContext) =>
	pullEmsPatientData(hospitalId);
