<script lang="ts">
	export let uploadUrl = './upload';
	export let inputLabel = '파일';
	export let helpText = '엑셀 파일을 선택하세요.';
	export let accept = '.xlsx';
	export let buttonLabel = '업로드';

	let selectedFile: File | null = null;
	let isUploading = false;
	let statusMessage = '';
	let statusTone: 'success' | 'error' | 'info' = 'info';

	const handleFileChange = (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
		statusMessage = '';
		statusTone = 'info';
	};

	const uploadFile = async () => {
		if (!selectedFile || isUploading) {
			statusTone = 'error';
			statusMessage = '업로드할 파일을 선택하세요.';
			return;
		}

		isUploading = true;
		statusMessage = '';
		statusTone = 'info';

		try {
			const formData = new FormData();
			formData.set('file', selectedFile);

			const response = await fetch(uploadUrl, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorPayload = await response.json().catch(() => ({}));
				const errorMessage =
					typeof errorPayload?.error === 'string'
						? errorPayload.error
						: '업로드에 실패했습니다.';
				throw new Error(errorMessage);
			}

			const payload = await response.json().catch(() => ({}));
			statusTone = 'success';
			statusMessage =
				typeof payload?.filename === 'string'
					? `${payload.filename} 업로드 완료`
					: '업로드 완료';
		} catch (error) {
			statusTone = 'error';
			statusMessage = error instanceof Error ? error.message : '업로드에 실패했습니다.';
		} finally {
			isUploading = false;
		}
	};
</script>

<div class="uploader">
	<div class="field">
		<span class="label">{inputLabel}</span>
		<label class="file-button">
			<input type="file" accept={accept} on:change={handleFileChange} />
			<span class="file-button-icon">+</span>
			<span class="file-button-text">파일 찾기</span>
		</label>
	</div>
	<p class="muted">
		{#if selectedFile}
			선택됨: {selectedFile.name}
		{:else}
			{helpText}
		{/if}
	</p>
	<div class="uploader-actions">
		<button class="button" type="button" on:click={uploadFile} disabled={!selectedFile || isUploading}>
			{isUploading ? '업로드 중...' : buttonLabel}
		</button>
	</div>
	{#if statusMessage}
		<p class={`upload-status ${statusTone}`}>{statusMessage}</p>
	{/if}
</div>

<style>
	.uploader {
		display: grid;
		gap: 12px;
	}

	.uploader-actions {
		display: flex;
		gap: 12px;
	}

	.label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--ink);
	}

	.file-button {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.7);
		box-shadow: 10px 10px 24px rgba(163, 181, 198, 0.25),
			-8px -8px 20px rgba(255, 255, 255, 0.8);
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.file-button:hover {
		transform: translateY(-1px);
		box-shadow: 12px 12px 26px rgba(163, 181, 198, 0.28),
			-10px -10px 22px rgba(255, 255, 255, 0.9);
	}

	.file-button:active {
		transform: translateY(0);
		box-shadow: inset 6px 6px 16px rgba(163, 181, 198, 0.25),
			inset -6px -6px 16px rgba(255, 255, 255, 0.9);
	}

	.file-button input {
		display: none;
	}

	.file-button-icon {
		width: 34px;
		height: 34px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		background: rgba(162, 191, 254, 0.35);
		color: var(--primary-strong);
		font-weight: 700;
		font-size: 1.1rem;
		box-shadow: inset 2px 2px 6px rgba(255, 255, 255, 0.7);
	}

	.file-button-text {
		font-weight: 600;
		color: var(--ink);
	}

	.upload-status {
		font-size: 0.9rem;
	}

	.upload-status.success {
		color: #1b7f3c;
	}

	.upload-status.error {
		color: #c0392b;
	}
 </style>
