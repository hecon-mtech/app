import { redirect, type Handle } from '@sveltejs/kit';
import { verifySessionToken } from '$lib/server/session';
import { getTenantHomePath, getTenantSegmentFromUserId, type TenantSegment } from '$lib/tenant';

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

		const isTenantRoute = pathname === '/hospital' || pathname.startsWith('/hospital/');

		if (pathname === `/${tenant}`) {
			throw redirect(303, getTenantHomePath(tenant));
		}
	}

	return resolve(event);
};
