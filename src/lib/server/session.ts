import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

type JwtHeader = {
	alg: 'HS256';
	typ: 'JWT';
};

type SessionPayload = {
	sub: string;
	name: string;
	iat: number;
	exp: number;
};

const SESSION_TTL_SECONDS = 60 * 60 * 6;

const base64Url = (input: Buffer | string) =>
	Buffer.from(input).toString('base64url');

const fromBase64Url = (input: string) => Buffer.from(input, 'base64url');

const getSecret = () => {
	const secret = env.SESSION_SECRET;
	if (!secret) {
		throw new Error('SESSION_SECRET is required for secure sessions.');
	}
	return secret;
};

export const createSessionToken = (payload: Pick<SessionPayload, 'sub' | 'name'>) => {
	const now = Math.floor(Date.now() / 1000);
	const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
	const body: SessionPayload = {
		...payload,
		iat: now,
		exp: now + SESSION_TTL_SECONDS
	};
	const headerB64 = base64Url(JSON.stringify(header));
	const bodyB64 = base64Url(JSON.stringify(body));
	const unsignedToken = `${headerB64}.${bodyB64}`;
	const signature = createHmac('sha256', getSecret()).update(unsignedToken).digest();
	const sigB64 = base64Url(signature);
	return `${unsignedToken}.${sigB64}`;
};

export const verifySessionToken = (token: string) => {
	const [headerB64, bodyB64, sigB64] = token.split('.');
	if (!headerB64 || !bodyB64 || !sigB64) return null;

	const expected = createHmac('sha256', getSecret())
		.update(`${headerB64}.${bodyB64}`)
		.digest();
	const actual = fromBase64Url(sigB64);
	if (actual.length !== expected.length) return null;
	if (!timingSafeEqual(actual, expected)) return null;

	try {
		const headerJson = fromBase64Url(headerB64).toString('utf-8');
		const header = JSON.parse(headerJson) as JwtHeader;
		if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

		const json = fromBase64Url(bodyB64).toString('utf-8');
		const payload = JSON.parse(json) as SessionPayload;
		if (!payload.sub || !payload.name || !payload.iat || !payload.exp) return null;
		if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
		return payload;
	} catch {
		return null;
	}
};
