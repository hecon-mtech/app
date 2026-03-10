export type TenantSegment = 'hospital' | 'hotels';

const HOSPITAL_PREFIX = 'HOSP';
const HOTEL_PREFIX = 'HOTEL';

export const getTenantSegmentFromUserId = (userId: string): TenantSegment => {
	if (userId.startsWith(HOTEL_PREFIX)) return 'hotels';
	if (userId.startsWith(HOSPITAL_PREFIX)) return 'hospital';
	return 'hospital';
};

export const getTenantSegmentFromPath = (pathname: string): TenantSegment => {
	if (pathname === '/hotels' || pathname.startsWith('/hotels/')) return 'hotels';
	return 'hospital';
};

export const getTenantHomePath = (tenant: TenantSegment) => `/${tenant}/dashboards`;
