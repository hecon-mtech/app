import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importUploadedPatientData } from '$lib/server/services/patients';
import { appendAssistantMessageToSession } from '$lib/server/services/messages';
import { isServiceError } from '$lib/server/services/errors';

const buildImportSummary = (result: Awaited<ReturnType<typeof importUploadedPatientData>>) =>
	[
		`환자 데이터 업로드를 반영했습니다.`,
		`- 유형: ${result.patientType === 'inpatient' ? '입원' : '외래'}`,
		`- 건수: ${result.insertedCount}건`,
		`- 기간: ${result.startDate} ~ ${result.endDate}`,
		`- 파일: ${result.fileName}`
	].join('\n');

export const POST: RequestHandler = async ({ locals, request }) => {
	const hospitalId = locals.user?.id ?? 'HOSP0001';
	const formData = await request.formData();
	const file = formData.get('file');
	const sessionId = formData.get('sessionId');
	const patientType = formData.get('patientType');

	if (!(file instanceof File)) {
		return json({ message: '업로드할 파일이 없습니다.' }, { status: 400 });
	}

	try {
		const result = await importUploadedPatientData({
			hospitalId,
			fileName: file.name,
			arrayBuffer: await file.arrayBuffer(),
			patientType: typeof patientType === 'string' ? patientType : null
		});

		if (sessionId !== null && String(sessionId).trim()) {
			const chatResult = await appendAssistantMessageToSession({
				hospitalId,
				sessionIdValue: String(sessionId),
				content: buildImportSummary(result)
			});

			return json({
				...result,
				...chatResult
			});
		}

		return json(result);
	} catch (error) {
		if (isServiceError(error)) {
			return json({ message: error.message }, { status: error.status });
		}

		throw error;
	}
};
