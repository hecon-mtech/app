import {
	getUsageForecast as getUsageForecastService,
	getUsageForecastDrugOptions as getUsageForecastDrugOptionsService,
	refreshNextWeekPrediction as refreshNextWeekPredictionService,
	runBentomlForecast as runBentomlForecastService
} from '../services/forecast';
import type { HospitalToolContext } from './types';

export const getUsageForecast = (
	{ hospitalId }: HospitalToolContext,
	input: {
		drugId: string | null;
		start: string | null;
		end: string | null;
		actualEnd?: string | null;
	}
) => getUsageForecastService({ hospitalId, ...input });

export const listUsageForecastDrugOptions = (
	{ hospitalId }: HospitalToolContext,
	input: { start: string | null; end: string | null }
) => getUsageForecastDrugOptionsService({ hospitalId, ...input });

export const refreshNextWeekPrediction = ({ hospitalId }: HospitalToolContext) =>
	refreshNextWeekPredictionService(hospitalId);

export const runUsageForecast = ({ hospitalId }: HospitalToolContext) =>
	runBentomlForecastService(hospitalId);
