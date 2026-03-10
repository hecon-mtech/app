import { redirect, type Handle } from '@sveltejs/kit';
import { verifySessionToken } from '$lib/server/session';
import {
	getTenantHomePath,
	getTenantSegmentFromPath,
	getTenantSegmentFromUserId,
	type TenantSegment
} from '$lib/tenant';

const LEGACY_ROUTE_MAPPERS: Array<{
	prefix: string;
	resolve: (tenant: TenantSegment, suffix: string) => string;
}> = [
	{ prefix: '/dashboard', resolve: (tenant, suffix) => `/${tenant}/dashboards${suffix}` },
	{ prefix: '/data-input', resolve: (tenant, suffix) => `/${tenant}/data-input${suffix}` },
	{ prefix: '/order', resolve: (tenant, suffix) => `/${tenant}/order${suffix}` },
	{ prefix: '/settings', resolve: (tenant, suffix) => `/${tenant}/settings${suffix}` }
];

const resolveLegacyRoute = (pathname: string, tenant: TenantSegment) => {
	for (const route of LEGACY_ROUTE_MAPPERS) {
		if (pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) {
			const suffix = pathname.slice(route.prefix.length);
			return route.resolve(tenant, suffix);
		}
	}

	return null;
};

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	const cookieToken = event.cookies.get('session');
	const authorization = event.request.headers.get('authorization');
	const bearerToken = authorization?.startsWith('Bearer ')
		? authorization.slice('Bearer '.length).trim()
		: null;
	let isAuthenticated = false;

	const token = bearerToken || cookieToken;
	if (token) {
		const payload = verifySessionToken(token);
		if (payload) {
			const tenant = getTenantSegmentFromUserId(payload.sub);
			event.locals.user = { id: payload.sub, name: payload.name, tenant };
			isAuthenticated = true;
		}
	}

	const isLoginRoute = pathname === '/login';
	const isRootRoute = pathname === '/';
	const isApiRoute = pathname.startsWith('/api');
	const isLogoutRoute = pathname === '/logout';

	if (isApiRoute && !isAuthenticated) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: {
				'content-type': 'application/json',
				'www-authenticate': 'Bearer'
			}
		});
	}

	if (!isAuthenticated && !isLoginRoute && !isLogoutRoute) {
		throw redirect(303, '/login');
	}

	if (isAuthenticated) {
		const tenant = getTenantSegmentFromUserId(event.locals.user?.id ?? '');

		if (isLoginRoute || isRootRoute) {
			throw redirect(303, getTenantHomePath(tenant));
		}

		const legacyRoute = resolveLegacyRoute(pathname, tenant);
		if (legacyRoute) {
			throw redirect(303, `${legacyRoute}${event.url.search}`);
		}

		const pathTenant = getTenantSegmentFromPath(pathname);
		const isTenantRoute =
			pathname === '/hospital' ||
			pathname.startsWith('/hospital/') ||
			pathname === '/hotels' ||
			pathname.startsWith('/hotels/');

		if (pathname === `/${tenant}`) {
			throw redirect(303, getTenantHomePath(tenant));
		}

		if (isTenantRoute && pathTenant !== tenant) {
			const wrongPrefix = pathTenant === 'hospital' ? '/hospital' : '/hotels';
			const suffix = pathname.slice(wrongPrefix.length);
			const nextPath = suffix ? `/${tenant}${suffix}` : getTenantHomePath(tenant);
			throw redirect(303, `${nextPath}${event.url.search}`);
		}
	}

	return resolve(event);
};
