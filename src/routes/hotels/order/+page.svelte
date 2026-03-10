<script lang="ts">
	import ListCard from '$lib/components/ListCard.svelte';
	import TableCard from '$lib/components/TableCard.svelte';

	const orderStatus = [
		{
			id: 'ORD-4012',
			location: '중환자실 북쪽',
			item: '인공호흡기 필터',
			status: 'urgent',
			statusLabel: '긴급'
		},
		{
			id: 'ORD-4013',
			location: '동쪽 병동',
			item: 'IV 키트 보충',
			status: 'warn',
			statusLabel: '배송 중'
		},
		{
			id: 'ORD-4014',
			location: '약국',
			item: '혈액 O+',
			status: 'ok',
			statusLabel: '도착 완료'
		}
	];

	const deliveryDetails = [
		{
			unit: '유닛 07',
			route: '중앙 -> ICU',
			eta: '8분',
			status: 'warn',
			statusLabel: '이동 중'
		},
		{
			unit: '유닛 11',
			route: '약국 -> 동쪽 병동',
			eta: '14분',
			status: 'ok',
			statusLabel: '정상'
		},
		{
			unit: '유닛 05',
			route: '검사실 -> ICU',
			eta: '21분',
			status: 'urgent',
			statusLabel: '지연'
		}
	];

	const deliveryColumns: Array<{ id: string; label: string; type?: 'text' | 'status' }> = [
		{ id: 'unit', label: '배송자' },
		{ id: 'route', label: '경로' },
		{ id: 'eta', label: '도착 예정' },
		{ id: 'statusLabel', label: '상태', type: 'status' }
	];
</script>

<section class="grid-2">
	<ListCard
		title="주문 현황"
		subtitle="핵심 소모품 및 배송 진행 상황."
		items={orderStatus}
		getLabel={() => ''}
		getValue={() => ''}
	>
		<svelte:fragment slot="item" let:item>
			<div>
				<div>{item.id} · {item.location}</div>
				<div class="muted">{item.item}</div>
			</div>
			<span class={`status ${item.status}`}>{item.statusLabel}</span>
		</svelte:fragment>
	</ListCard>

	<TableCard
		title="배송 상세"
		subtitle="경로 및 예상 도착 시간을 관리하세요."
		columns={deliveryColumns}
		rows={deliveryDetails}
	/>
</section>
