import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { isServiceError } from '$lib/server/services/errors';
import {
	createOpenAiCredential,
	deleteOpenAiCredential,
	getOpenAiCredentialsState
} from '$lib/openai/agent/credentials';
import { OPENAI_SELECTED_CREDENTIAL_COOKIE } from '$lib/openai/constants';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const userId = locals.user?.id ?? 'HOSP0001';

	try {
		return json(await getOpenAiCredentialsState(userId, cookies.get(OPENAI_SELECTED_CREDENTIAL_COOKIE)));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};

export const DELETE: RequestHandler = async ({ locals, url, cookies }) => {
	const userId = locals.user?.id ?? 'HOSP0001';
	const credentialId = url.searchParams.get('credentialId');

	try {
		const result = await deleteOpenAiCredential(userId, credentialId);
		const selectedId = cookies.get(OPENAI_SELECTED_CREDENTIAL_COOKIE);
		if (selectedId && Number(selectedId) === result.credentialId) {
			cookies.delete(OPENAI_SELECTED_CREDENTIAL_COOKIE, { path: '/' });
		}
		return json(result);
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = locals.user?.id ?? 'HOSP0001';
	const payload = await request.json().catch(() => null);

	try {
		return json(await createOpenAiCredential(userId, payload));
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
