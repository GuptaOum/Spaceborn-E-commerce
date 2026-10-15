-- The delivery code is no longer minted at checkout. The vendor asks for it at the customer's
-- door; the server then generates a short-lived code and sends it to the customer for that order.
alter table orders alter column handover_otp drop not null;
alter table orders
  add column handover_otp_sent_at    timestamptz,
  add column handover_otp_expires_at timestamptz;

-- Codes minted at checkout must not survive. The vendor asks for a new one at the door.
update orders
   set handover_otp = null
 where handover_otp is not null
   and status in ('pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery');
