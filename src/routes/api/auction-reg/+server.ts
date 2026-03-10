import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { drizzleDb } from '$lib/server/db';
import { auctionRegInventory } from '$lib/server/db/schema';

const addDays = (value: Date, days: number) => {
	const next = new Date(value);
	next.setDate(next.getDate() + days);
	return next;
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const hospitalId = locals.user?.id;
	if (!hospitalId) {
		return json({ message: 'Unauthorized.' }, { status: 401 });
	}

	const payload = await request.json().catch(() => null);
	const drugId = typeof payload?.drugId === 'string' ? payload.drugId.trim() : '';
	const quantityValue = Number(payload?.quantity);
	const quantity = Number.isInteger(quantityValue) ? quantityValue : NaN;

	if (!drugId) {
		return json({ message: 'drugId is required.' }, { status: 400 });
	}

	if (!Number.isInteger(quantity) || quantity <= 0) {
		return json({ message: 'quantity must be a positive integer.' }, { status: 400 });
	}

	const createdAt = new Date();
	const expireAt = addDays(createdAt, 2);

	try {
		const [inserted] = await drizzleDb
			.insert(auctionRegInventory)
			.values({
				hospitalId,
				drugId,
				quantity: String(quantity),
				expireAt,
				createdAt,
				updatedAt: createdAt
			})
			.returning({ id: auctionRegInventory.id });

		return json({
			message: '주문이 등록되었습니다.',
			id: inserted.id,
			drugId,
			quantity,
			expireAt: expireAt.toISOString()
		});
	} catch {
		return json({ message: '주문 등록에 실패했습니다.' }, { status: 500 });
	}
};
