-- The delivery code is no longer minted at checkout. The vendor asks for it at the customer's
-- door; the server then generates a short-lived code and sends it to the customer for that order.
alter table orders alter column handover_otp drop not null;
alter table orders
  add column handover_otp_sent_at    timestamptz,
  add column handover_otp_expires_at timestamptz;

-- Orders already in flight keep the code the customer was shown at checkout, and it stays
-- valid long enough for the vendor to close them.
update orders
   set handover_otp_sent_at = now(),
       handover_otp_expires_at = now() + interval '7 days'
 where handover_otp is not null
   and status in ('pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery');
