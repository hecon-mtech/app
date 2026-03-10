<script lang="ts">
	import FileUploader from '$lib/components/FileUploader.svelte';
	import Modal from '$lib/components/Modal.svelte';

	let emsLoading = false;
	let predictLoading = false;
	let modalOpen = false;
	let modalTitle = '';
	let modalMessage = '';
	let modalTone: 'success' | 'error' | 'info' = 'info';
	let showPredictButton = false;

	const openModal = (title: string, message: string, tone: 'success' | 'error' | 'info') => {
		modalTitle = title;
		modalMessage = message;
		modalTone = tone;
		modalOpen = true;
	};

	const pullFromEms = async () => {
		if (emsLoading) return;
		emsLoading = true;
		openModal('EMS 데이터 동기화', 'EMS 데이터를 가져오는 중입니다...', 'info');
		showPredictButton = false;

		try {
			const response = await fetch('/api/ems/pull-patient-data', { method: 'POST' });
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(
					typeof payload?.message === 'string' ? payload.message : 'EMS 데이터 입력에 실패했습니다.'
				);
			}

			modalTitle = 'EMS 데이터 동기화 완료';
			modalTone = 'success';
			modalMessage = 'Patient data successfully inserted.';
			showPredictButton = true;
		} catch (error) {
			modalTitle = 'EMS 데이터 동기화 실패';
			modalTone = 'error';
			modalMessage =
				error instanceof Error ? error.message : 'EMS 데이터 입력에 실패했습니다. 잠시 후 다시 시도하세요.';
		} finally {
			emsLoading = false;
		}
	};

	const runNextWeekPrediction = async () => {
		if (predictLoading) return;
		predictLoading = true;
		modalTitle = '다음주 예측';
		modalTone = 'info';
		modalMessage = '다음주 예측을 생성 중입니다...';

		try {
			const response = await fetch('/api/usage-forecast/next-week', { method: 'POST' });
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(
					typeof payload?.message === 'string'
						? payload.message
						: '다음주 예측 생성에 실패했습니다.'
				);
			}

			modalTitle = '예측 반영 완료';
			modalTone = 'success';
			modalMessage =
				typeof payload?.message === 'string'
					? payload.message
					: '다음주 예측이 반영되었습니다.';
			showPredictButton = false;
		} catch (error) {
			modalTitle = '예측 반영 실패';
			modalTone = 'error';
			modalMessage =
				error instanceof Error ? error.message : '다음주 예측 생성에 실패했습니다. 잠시 후 다시 시도하세요.';
		} finally {
			predictLoading = false;
		}
	};
</script>

<div class="download-bar card">
	<div>
		<h3>EMS에서 데이터 끌어오기</h3>
		<p class="muted">2024-12-01 ~ 2024-12-07 환자 데이터를 자동으로 입력합니다.</p>
	</div>
	<div class="download-actions">
		<button class="button" type="button" on:click={pullFromEms} disabled={emsLoading || predictLoading}>
			{emsLoading ? '불러오는 중...' : 'EMS에서 데이터 끌어오기'}
		</button>
	</div>
</div>

<div class="download-bar card fallback-bar">
	<div>
		<h3>데이터 입력 양식</h3>
		<p class="muted">데이터 입력이 성공적이지 않을 시 엑셀 양식을 다운로드해 수동 업로드하세요.</p>
	</div>
	<div class="download-actions">
		<a class="button" href="/templates/inpatient_data_format.xlsx" download>
			입원 환자 양식 다운로드
		</a>
		<a class="button" href="/templates/outpatient_data_format.xlsx" download>
			외래 환자 양식 다운로드
		</a>
	</div>
</div>

<section class="grid-2">
	<div class="card">
		<h3>입원 환자 데이터 업로드</h3>
		<p class="muted">입원 환자 데이터를 엑셀 파일로 업로드하세요.</p>
		<FileUploader
			inputLabel="입원 환자 파일"
			helpText="입원 환자 엑셀(.xlsx) 파일을 선택하세요."
			buttonLabel="입원 환자 업로드"
		/>
	</div>

	<div class="card">
		<h3>외래 환자 데이터 업로드</h3>
		<p class="muted">외래 환자 데이터를 엑셀 파일로 업로드하세요.</p>
		<FileUploader
			inputLabel="외래 환자 파일"
			helpText="외래 환자 엑셀(.xlsx) 파일을 선택하세요."
			buttonLabel="외래 환자 업로드"
		/>
	</div>
</section>

<style>
	.download-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 20px 24px;
	}

	.download-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.fallback-bar {
		margin-top: 18px;
	}

	.modal-body {
		margin: 0;
	}

	.modal-body.success {
		color: #1b7f3c;
	}

	.modal-body.error {
		color: #c0392b;
	}
</style>

<Modal open={modalOpen} title={modalTitle} on:close={() => (modalOpen = false)}>
	<p class={`modal-body ${modalTone}`}>{modalMessage}</p>
	<div slot="footer">
		{#if showPredictButton}
			<button class="button" type="button" on:click={runNextWeekPrediction} disabled={predictLoading}>
				{predictLoading ? '처리 중...' : '다음주 예측 진행'}
			</button>
		{/if}
		<button class="button" type="button" on:click={() => (modalOpen = false)}>닫기</button>
	</div>
</Modal>
