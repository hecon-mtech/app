<script lang="ts">
	import ListCard from '$lib/components/ListCard.svelte';
	import TableCard from '$lib/components/TableCard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import OpenAiCredentialsCard from '$lib/components/OpenAiCredentialsCard.svelte';

	const systemSettings = [
		{ label: 'Postgres 자동 동기화', value: '활성화', status: 'ok' },
		{ label: '핵심 소모품 알림', value: '우선', status: 'warn' },
		{ label: '일일 요약 이메일', value: '오전 08:00', status: 'ok' }
	];

	const teamAccess = [
		{ role: '운영 리드', permission: '전체', scope: '전체 병동' },
		{ role: '간호 코디네이터', permission: '제한', scope: '담당 병동' },
		{ role: '물자 매니저', permission: '재고', scope: '약국 + 창고' }
	];

	const teamAccessColumns = [
		{ id: 'role', label: '역할' },
		{ id: 'permission', label: '권한' },
		{ id: 'scope', label: '범위' }
	];

	let confirmOpen = false;
	let resultOpen = false;
	let resetting = false;
	let resultTitle = '';
	let resultMessage = '';

	const runReset = async () => {
		if (resetting) return;
		resetting = true;
		try {
			const response = await fetch('/api/demo/reset', { method: 'POST' });
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(typeof payload?.message === 'string' ? payload.message : '초기화에 실패했습니다.');
			}
			resultTitle = '데모 초기화 완료';
			resultMessage =
				typeof payload?.message === 'string'
					? payload.message
					: '데모 데이터가 12/07 기준 상태로 초기화되었습니다.';
		} catch (error) {
			resultTitle = '데모 초기화 실패';
			resultMessage = error instanceof Error ? error.message : '초기화에 실패했습니다.';
		} finally {
			resetting = false;
			confirmOpen = false;
			resultOpen = true;
		}
	};
</script>

<section class="grid-2">
	<ListCard
		title="시스템 설정"
		subtitle="알림, 동기화, 접근 권한을 관리하세요."
		items={systemSettings}
		getLabel={(item) => item.label}
		getValue={(item) => item.value}
		tone={(_, item) => item.status}
	/>
	<TableCard
		title="팀 접근"
		subtitle="역할 및 권한을 병동별로 관리하세요."
		columns={teamAccessColumns}
		rows={teamAccess}
	/>
</section>

<OpenAiCredentialsCard />

<section class="card reset-card">
	<h3>데모 관리</h3>
	<p class="muted">시연 후 실제/환자 데이터는 12/01부터 제거하고, 예측/주문 데이터는 12/08부터 제거해 12/07 기준 상태로 되돌립니다.</p>
	<button class="button" type="button" on:click={() => (confirmOpen = true)}>데모 초기화</button>
</section>

<Modal open={confirmOpen} title="데모 초기화" on:close={() => (confirmOpen = false)}>
	<p class="modal-body">실제/환자 데이터(12/01 이후)와 예측/주문 데이터(12/08 이후)를 초기화하고 12/07 기준 상태로 복원하시겠습니까?</p>
	<div slot="footer">
		<button class="button" type="button" on:click={runReset} disabled={resetting}>
			{resetting ? '초기화 중...' : '초기화 실행'}
		</button>
		<button class="button" type="button" on:click={() => (confirmOpen = false)} disabled={resetting}>
			취소
		</button>
	</div>
</Modal>

<Modal open={resultOpen} title={resultTitle} on:close={() => (resultOpen = false)}>
	<p class="modal-body">{resultMessage}</p>
	<div slot="footer">
		<button class="button" type="button" on:click={() => window.location.reload()}>새로고침</button>
		<button class="button" type="button" on:click={() => (resultOpen = false)}>닫기</button>
	</div>
</Modal>

<style>
	.reset-card {
		margin-top: 20px;
		display: grid;
		gap: 10px;
	}

	.reset-card h3,
	.modal-body {
		margin: 0;
	}
</style>
