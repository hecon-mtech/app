import { resetDemoData } from '../services/demo';
import type { HospitalToolContext } from './types';

export const resetDemoWorkspace = ({ hospitalId }: HospitalToolContext) => resetDemoData(hospitalId);
