import { config } from './config.js';
import { pool } from './db/pool.js';
import { otpBlock, renderHtml, sendMail } from './lib/mail.js';
import type { OrderStatus } from './orders/status.js';

const inr = (n: number | string) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface OrderMailRow {
  id: string;
  order_number: number;
  status: OrderStatus;
  grand_total: string;
  eta_minutes: number;
  handover_otp: string;
  cancel_reason: string | null;
  delivery_address: { fullName?: string; line1?: string; city?: string; pincode?: string };
  customer_email: string | null;
  customer_name: string | null;
  store_name: string;
  store_phone: string;
  vendor_email: string | null;
  items: { name: string; quantity: number; lineTotal: string }[];
}

async function loadOrder(orderId: string): Promise<OrderMailRow | null> {
  const { rows } = await pool.query<OrderMailRow>(
    `select o.id, o.order_number, o.status, o.grand_total, o.eta_minutes, o.handover_otp, o.cancel_reason, o.delivery_address,
            u.email as customer_email, coalesce(u.full_name, o.delivery_address->>'fullName') as customer_name,
            s.name as store_name, s.phone as store_phone, v.email as vendor_email,
            coalesce((select json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'lineTotal', oi.line_total) order by oi.name)
               from order_items oi where oi.order_id = o.id), '[]'::json) as items
       from orders o
       join users u on u.id = o.customer_id
       join stores s on s.id = o.store_id
       join users v on v.id = s.owner_id
      where o.id = $1`,
    [orderId],
  );
  return rows[0] ?? null;
}

const itemLines = (o: OrderMailRow) => o.items.map((i) => `${i.quantity} × ${i.name} — ${inr(i.lineTotal)}`);

export async function notifyOrderPlaced(orderId: string) {
  const o = await loadOrder(orderId);
  if (!o) return;
  const ordersUrl = `${config.PUBLIC_ORIGIN}/orders`;

  if (o.customer_email) {
    const lines = [
      `Hi ${o.customer_name ?? 'there'}, your order <b>#${o.order_number}</b> is confirmed and <b>${o.store_name}</b> is packing it now.`,
      `Estimated delivery: <b>~${o.eta_minutes} minutes</b>. Total paid: <b>${inr(o.grand_total)}</b>.`,
      `Share this handover code with the rider when your order arrives:`,
      otpBlock(o.handover_otp),
      `Items:<br>${itemLines(o).join('<br>')}`,
    ];
    await sendMail({
      to: o.customer_email,
      subject: `Order #${o.order_number} confirmed · handover code ${o.handover_otp}`,
      text: [
        `Your Spaceborn order #${o.order_number} is confirmed. ${o.store_name} is packing it now.`,
        `ETA ~${o.eta_minutes} min. Total ${inr(o.grand_total)}.`,
        `Handover code (give to the rider): ${o.handover_otp}`,
        '',
        ...itemLines(o).map((l) => l.replace(' × ', 'x ')),
        '',
        `Track: ${ordersUrl}`,
      ].join('\n'),
      html: renderHtml('Order confirmed', lines, { label: 'Track your order', href: ordersUrl }),
    });
  }

  if (o.vendor_email) {
    const a = o.delivery_address;
    const lines = [
      `New paid order <b>#${o.order_number}</b> worth <b>${inr(o.grand_total)}</b>. Accept it in the vendor hub to start packing.`,
      `Deliver to: ${a.fullName ?? ''}, ${a.line1 ?? ''}, ${a.city ?? ''} ${a.pincode ?? ''}`,
      `Items:<br>${itemLines(o).join('<br>')}`,
    ];
    await sendMail({
      to: o.vendor_email,
      subject: `New order #${o.order_number} · ${inr(o.grand_total)}`,
      text: [`New paid order #${o.order_number} (${inr(o.grand_total)}).`, ...itemLines(o), `Open: ${config.VENDOR_ORIGIN}`].join('\n'),
      html: renderHtml('New order to pack', lines, { label: 'Open vendor hub', href: config.VENDOR_ORIGIN }),
    });
  }
}

const STATUS_COPY: Partial<Record<OrderStatus, { subject: string; body: string }>> = {
  accepted: { subject: 'is being packed', body: 'The store accepted your order and is packing it now.' },
  out_for_delivery: { subject: 'is out for delivery', body: 'A rider has picked up your order. Keep your handover code ready.' },
  delivered: { subject: 'was delivered', body: 'Your order has been delivered. Thanks for shopping with Spaceborn!' },
  cancelled: { subject: 'was cancelled', body: 'Your order was cancelled. If you already paid, the refund is on its way (5-7 working days).' },
};

export async function notifyOrderStatus(orderId: string, to: OrderStatus) {
  const copy = STATUS_COPY[to];
  if (!copy) return;
  const o = await loadOrder(orderId);
  if (!o?.customer_email) return;
  const lines = [`Hi ${o.customer_name ?? 'there'}, order <b>#${o.order_number}</b> from ${o.store_name} ${copy.subject}.`, copy.body];
  if (to === 'out_for_delivery') lines.push('Handover code:', otpBlock(o.handover_otp));
  if (to === 'cancelled' && o.cancel_reason) lines.push(`Reason: ${o.cancel_reason}`);
  await sendMail({
    to: o.customer_email,
    subject: `Order #${o.order_number} ${copy.subject}`,
    text: `Order #${o.order_number} ${copy.subject}. ${copy.body}${to === 'out_for_delivery' ? ` Handover code: ${o.handover_otp}` : ''}`,
    html: renderHtml(`Order #${o.order_number} ${copy.subject}`, lines, { label: 'View order', href: `${config.PUBLIC_ORIGIN}/orders` }),
  });
}

interface JobMailRow {
  job_number: number;
  status: string;
  kind: string;
  quote_amount: string | null;
  customer_email: string | null;
  customer_name: string | null;
  store_name: string;
  vendor_email: string | null;
}

async function loadJob(jobId: string) {
  const { rows } = await pool.query<JobMailRow>(
    `select j.job_number, j.status, l.kind, j.quote_amount, u.email as customer_email, u.full_name as customer_name,
            s.name as store_name, v.email as vendor_email
       from fab_jobs j
       join service_listings l on l.id = j.listing_id
       join users u on u.id = j.customer_id
       join stores s on s.id = j.store_id
       join users v on v.id = s.owner_id
      where j.id = $1`,
    [jobId],
  );
  return rows[0] ?? null;
}

const kindLabel = (k: string) => (k === 'cnc' ? 'CNC machining' : '3D printing');

export async function notifyJobSubmitted(jobId: string) {
  const j = await loadJob(jobId);
  if (!j?.vendor_email) return;
  await sendMail({
    to: j.vendor_email,
    subject: `New ${kindLabel(j.kind)} request #${j.job_number}`,
    text: `A customer requested a ${kindLabel(j.kind)} quote (#${j.job_number}). Review the files and send a quote: ${config.VENDOR_ORIGIN}`,
    html: renderHtml('New fabrication request', [`Job <b>#${j.job_number}</b> (${kindLabel(j.kind)}) is waiting for your quote.`], {
      label: 'Quote in vendor hub',
      href: config.VENDOR_ORIGIN,
    }),
  });
}

export async function notifyJobStatus(jobId: string, to: string) {
  const j = await loadJob(jobId);
  if (!j?.customer_email) return;
  const copy: Record<string, string> = {
    quoted: `${j.store_name} quoted ${j.quote_amount ? inr(j.quote_amount) : 'a price'} for your ${kindLabel(j.kind)} job. Accept it within 48 hours to start production.`,
    in_production: `${j.store_name} has started producing your part.`,
    ready: 'Your part is ready and will be dispatched shortly.',
    out_for_delivery: 'Your part is out for delivery.',
    delivered: 'Your part has been delivered. Thanks for building with Spaceborn!',
    declined: `${j.store_name} could not take this job. You can request a quote from another maker.`,
    cancelled: 'Your fabrication job was cancelled. Any payment will be refunded.',
  };
  const body = copy[to];
  if (!body) return;
  await sendMail({
    to: j.customer_email,
    subject: `Fabrication job #${j.job_number}: ${to.replace(/_/g, ' ')}`,
    text: `${body}\n${config.PUBLIC_ORIGIN}/fabrication`,
    html: renderHtml(`Job #${j.job_number} update`, [`Hi ${j.customer_name ?? 'there'},`, body], {
      label: 'View job',
      href: `${config.PUBLIC_ORIGIN}/fabrication`,
    }),
  });
}
