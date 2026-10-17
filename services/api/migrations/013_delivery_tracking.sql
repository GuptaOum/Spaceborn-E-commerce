-- The store delivers its own orders: there is no courier fleet. While an order is out for delivery
-- the shop's rider shares their position from the Seller Hub. The latest fix lives on the order row
-- so every API task, and the customer's tracking stream, read the same point; Redis pub/sub is only
-- the fast path that pushes it to an open stream without waiting for the next poll.
alter table orders
  add column rider_lat numeric(9, 6),
  add column rider_lng numeric(9, 6),
  add column rider_at  timestamptz;
