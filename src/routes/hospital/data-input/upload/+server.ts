import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importUploadedPatientData } from '$lib/server/services/patients';
import { isServiceError } from '$lib/server/services/errors';

export const POST: RequestHandler = async ({ locals, request }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	const formData = await request.formData();
	const file = formData.get('file');
	const patientType = formData.get('patientType');

	if (!(file instanceof File)) {
		return json({ message: '업로드할 파일이 없습니다.' }, { status: 400 });
	}

	try {
		return json(
			await importUploadedPatientData({
				hospitalId,
				fileName: file.name,
				arrayBuffer: await file.arrayBuffer(),
				patientType: typeof patientType === 'string' ? patientType : null
			})
		);
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
