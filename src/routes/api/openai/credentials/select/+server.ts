import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { OPENAI_SELECTED_CREDENTIAL_COOKIE } from '$lib/openai/constants';
import { isServiceError } from '$lib/server/services/errors';
import { ensureSelectableOpenAiCredential } from '$lib/openai/agent/credentials';

export const POST: RequestHandler = async ({ locals, cookies, request }) => {
	const userId = locals.user?.id ?? 'HOSP0001';
	const payload = await request.json().catch(() => null);

	try {
		const selection = await ensureSelectableOpenAiCredential(
			userId,
			(payload as { credentialId?: unknown })?.credentialId
		);

		cookies.set(OPENAI_SELECTED_CREDENTIAL_COOKIE, String(selection.credentialId), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 60 * 60 * 24 * 30
		});

		return json(selection);
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
