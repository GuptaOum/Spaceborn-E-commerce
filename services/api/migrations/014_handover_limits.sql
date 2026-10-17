-- A burned delivery code used to clear handover_otp_sent_at, which skipped the resend cooldown and
-- let a vendor mint a fresh code immediately. mints caps how many codes one order can ever have.
alter table orders add column handover_otp_mints integer not null default 0;

-- Fabrication used one code from the moment the job was submitted, with no expiry. The code is now
-- minted when the maker's rider leaves, same as a catalogue order.
alter table fab_jobs alter column handover_otp drop not null;
alter table fab_jobs
  add column handover_otp_sent_at    timestamptz,
  add column handover_otp_expires_at timestamptz,
  add column handover_otp_attempts   integer not null default 0;

update fab_jobs
   set handover_otp = null
 where status is distinct from 'out_for_delivery';
