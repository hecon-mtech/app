import { getAlarmItems } from '../services/orders';
import type { HospitalToolContext } from './types';

export const listAlerts = ({ hospitalId }: HospitalToolContext) => getAlarmItems(hospitalId);
