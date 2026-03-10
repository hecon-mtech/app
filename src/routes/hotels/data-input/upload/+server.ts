import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const resolveUploadDir = () => {
	const configuredDir = env.FILE_UPLOAD_DIR?.trim() || './raw';
	return path.isAbsolute(configuredDir)
		? configuredDir
		: path.resolve(process.cwd(), configuredDir);
};

const buildSafeFilename = (filename: string) => {
	const baseName = path.basename(filename || 'upload.xlsx');
	return `${Date.now()}_${baseName}`;
};

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
	}

	const uploadDir = resolveUploadDir();
	await mkdir(uploadDir, { recursive: true });

	const arrayBuffer = await file.arrayBuffer();
	const safeFilename = buildSafeFilename(file.name);
	const targetPath = path.join(uploadDir, safeFilename);

	await writeFile(targetPath, Buffer.from(arrayBuffer));

	return json({ filename: safeFilename });
};
