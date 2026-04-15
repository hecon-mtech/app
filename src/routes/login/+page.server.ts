import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { drizzleDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createSessionToken } from '$lib/server/session';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import { getTenantHomePath } from '$lib/tenant';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!id || !password) {
			return fail(400, { error: '아이디와 비밀번호를 입력해주세요.' });
		}

		const result = await drizzleDb
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);

		const user = result[0];
		if (!user) {
			return fail(401, { error: '로그인 정보가 올바르지 않습니다.' });
		}

		const stored = user.password;
		const isHashed = stored.startsWith('scrypt$');
		const ok = isHashed ? verifyPassword(password, stored) : stored === password;

		if (!ok) {
			return fail(401, { error: '로그인 정보가 올바르지 않습니다.' });
		}

		if (!isHashed) {
			const nextHash = hashPassword(password);
			await drizzleDb
				.update(users)
				.set({ password: nextHash, updatedAt: new Date() })
				.where(eq(users.id, id));
		}

		const token = createSessionToken({ sub: user.id, name: user.name });
		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 6
		});

		throw redirect(303, getTenantHomePath());
	}
};
