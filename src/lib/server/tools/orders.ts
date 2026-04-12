import {
	createAuctionOrder as createAuctionOrderService,
	getAuctionOrdersPageData,
	getRecentOrders as getRecentOrdersService
} from '../services/orders';
import type { HospitalToolContext } from './types';

export const listRecentOrders = ({ hospitalId }: HospitalToolContext) =>
	getRecentOrdersService(hospitalId);

export const createAuctionOrder = ({ hospitalId }: HospitalToolContext, payload: unknown) =>
	createAuctionOrderService(hospitalId, payload);

export const getAuctionOrdersPage = (
	{ hospitalId }: HospitalToolContext,
	requestedRange: string | null
) => getAuctionOrdersPageData(hospitalId, requestedRange);
