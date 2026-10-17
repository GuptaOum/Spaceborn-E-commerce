import type { Db } from '../db/pool.js';

// A payment is refunded once the ledger adds up to what was paid. A partly refunded payment goes
// back to captured so the admin's "refunds pending" count only shows refunds that are still owed.
export async function settleRefundStatus(db: Db, paymentId: string) {
  await db.query(
    `update payments p set status = case
         when coalesce((select sum(r.amount_paise) from payment_refunds r where r.payment_id = p.id), 0) >= p.amount_paise then 'refunded'
         else 'captured' end::payment_status
      where p.id = $1 and p.status in ('captured', 'refund_pending')`,
    [paymentId],
  );
}

export interface RefundRequest {
  paymentId: string;
  orderId?: string;
  jobId?: string;
  providerPaymentId: string | null;
  amountPaise: number;
}

// What is still owed for one refund request: never more than was paid minus what went back already.
export async function refundOwed(db: Db, request: RefundRequest) {
  const reference = (request.orderId ?? request.jobId)!;
  const { rows } = await db.query<{ status: string; amount_paise: number; refunded: number; done: boolean }>(
    `select p.status, p.amount_paise,
            coalesce((select sum(r.amount_paise) from payment_refunds r where r.payment_id = p.id), 0)::bigint as refunded,
            exists(select 1 from payment_refunds r where r.payment_id = p.id and r.reference = $2) as done
       from payments p where p.id = $1`,
    [request.paymentId, reference],
  );
  const payment = rows[0];
  if (!payment || payment.status === 'created' || payment.status === 'failed' || payment.done) return { reference, amount: 0 };
  const remaining = Number(payment.amount_paise) - Number(payment.refunded);
  return { reference, amount: Math.max(0, Math.min(Number(request.amountPaise), remaining)) };
}

export async function recordRefund(db: Db, paymentId: string, reference: string, amount: number, providerRefundId: string | null) {
  await db.query(
    `insert into payment_refunds (payment_id, reference, amount_paise, provider_refund_id)
     values ($1, $2, $3, $4) on conflict (payment_id, reference) do nothing`,
    [paymentId, reference, amount, providerRefundId],
  );
  await settleRefundStatus(db, paymentId);
}
