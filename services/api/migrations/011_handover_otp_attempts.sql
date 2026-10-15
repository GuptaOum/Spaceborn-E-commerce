-- Wrong delivery-code guesses are counted on the order, not in process memory.
-- Five wrong codes burn the current code. A resend while it is still live repeats it.
alter table orders
  add column handover_otp_attempts integer not null default 0;

-- Checkout-era codes (including the 7-day backfill from 010) must not stay valid.
update orders
   set handover_otp = null,
       handover_otp_sent_at = null,
       handover_otp_expires_at = null,
       handover_otp_attempts = 0
 where status in ('pending_payment', 'placed', 'accepted', 'packing', 'ready_for_pickup', 'out_for_delivery');
