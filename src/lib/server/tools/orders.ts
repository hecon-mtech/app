import {
	createAuctionOrder as createAuctionOrderService,
	getCurrentAuctionStatus as getCurrentAuctionStatusService,
	getAuctionOrdersPageData,
	getRecentOrders as getRecentOrdersService,
	getStockShortageOrders as getStockShortageOrdersService
} from '../services/orders';
import type { HospitalToolContext } from './types';

export const listRecentOrders = ({ hospitalId }: HospitalToolContext) =>
	getRecentOrdersService(hospitalId);

export const listStockShortageOrders = ({ hospitalId }: HospitalToolContext) =>
	getStockShortageOrdersService(hospitalId);

export const getCurrentAuctionStatus = (
	{ hospitalId }: HospitalToolContext,
	input: { range?: string | null } = {}
) => getCurrentAuctionStatusService(hospitalId, input.range ?? null);

export const createAuctionOrder = ({ hospitalId }: HospitalToolContext, payload: unknown) =>
	createAuctionOrderService(hospitalId, payload);

export const getAuctionOrdersPage = (
	{ hospitalId }: HospitalToolContext,
	requestedRange: string | null
) => getAuctionOrdersPageData(hospitalId, requestedRange);
