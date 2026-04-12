import { getBannerItems } from '../services/orders';
import type { HospitalToolContext } from './types';

export const listAlerts = ({ hospitalId }: HospitalToolContext) => getBannerItems(hospitalId);
