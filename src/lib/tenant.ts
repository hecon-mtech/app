export type TenantSegment = 'hospital';

export const getTenantSegmentFromUserId = (_userId: string): TenantSegment => 'hospital';

export const getTenantSegmentFromPath = (_pathname: string): TenantSegment => 'hospital';

export const getTenantHomePath = (_tenant: TenantSegment = 'hospital') => '/hospital/dashboards';
