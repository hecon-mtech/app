import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const code = url.searchParams.get('code') ?? '';
	const state = url.searchParams.get('state') ?? '';
	const target = new URL('/hospital/openai/connect', url.origin);
	if (code) target.searchParams.set('code', code);
	if (state) target.searchParams.set('state', state);
	redirect(302, target.toString());
};
