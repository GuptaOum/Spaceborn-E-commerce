# Spaceborn — project handoff

Source of truth for the next agent. Last updated 3 Oct 2026, production `main` at `075765a`
(`feat: backend PostgreSQL persistence for customer reviews`). Demo `main` is the same work
as merge `6a18665`. Working tree was clean.

Quick commerce for electronics and robotics parts, plus on-demand 3D printing and CNC.
Customers see one pooled catalog. The server picks the nearest shop that can fill each line,
splits a purchase into deliveries when it has to, and takes one payment. Shop names stay off
the customer pages. Fabrication is the exception: the customer is booking that shop's machine.

---

## Where the code lives

| | |
| :--- | :--- |
| Local production checkout | `D:\spacebornecomm\spacebornecomprod` |
| Production remote `origin` | `https://github.com/Spaceborn-Beyond-Autonomous/Spaceborn-E-commerce.git` (`main`) |
| Demo remote `demo` | `https://github.com/GuptaOum/spacebornecomdemo.git` (`main`) |
| Live demo | `https://spacebornecomdemo-1.onrender.com` (Render service `spacebornecomdemo-1`, free, Virginia, auto-deploy on `demo/main`) |
| Archive | `D:\spacebornecomm\_backup_Spaceborn-E-commerce` (do not treat as the app) |

Push production first, then merge `main` into the `demo-sync` branch and push `demo demo-sync:main`.
The demo and production trees are meant to stay the same code. What differs is environment.

`scripts/render-gateway.mjs` runs the API, the three Next apps, and the outbox worker in one
container. `?app=store|vendor|admin` (cookie) picks the app. A demo-only "Hub" pill switches
between them. On phones it collapses to a small toggle; it still covers section titles.

Do not add a second Render service. Do not add Celery, RabbitMQ, Zustand, or DynamoDB.
The worker is `services/api/src/worker.ts`: it polls the Postgres outbox (`FOR UPDATE SKIP LOCKED`).

Heavy builds and the API integration tests go to AWS CodeBuild project `spaceborn-build`
(ap-south-1). The laptop is too weak for a full local build. Last full API run that was
confirmed green was 59/59, before the review and product-detail commits below.

---

## Production AWS (not serving traffic)

Region `ap-south-1`. Terraform is in `terraform/`. Domain in `terraform.tfvars` is
`elbotrob.me` (gitignored). ACM certs for `elbotrob.me` and `*.elbotrob.me` are issued in
ap-south-1 and us-east-1. DNS at Namecheap still points at GitHub Pages. Go-live is later,
on purpose.

CloudFront that already exists, comment `spaceborn-dev`, no aliases:

- `d1my794d3ygm15.cloudfront.net` — storefront + API
- `d2zizda8lkhnw6.cloudfront.net` — vendor hub

Do not run `terraform apply` or `ops/spaceborn.ps1 up`. Do not close or recreate those
CloudFront distributions. Secrets Manager secret `spaceborn-prod/app` was marked for deletion;
restore it before a real deploy. `PAYMENTS_ALLOW_MOCK=false` in production.

Firebase authorized domains still to add: `elbotrob.me`, `vendor.elbotrob.me`,
`spacebornecomdemo-1.onrender.com`, and the two CloudFront hosts. `localhost` is already there.

---

## How the shop actually works

npm workspaces:

```
services/api              Express 5, pg, zod, razorpay, firebase-admin. Business logic and RBAC.
packages/web-core         Firebase auth, api() client, shared types.
apps/customer-storefront  Next.js. The only app in the recent UX work.
apps/vendor-hub           Next.js. Inventory, orders, fabrication quotes.
apps/admin-panel          Next.js. Approvals, catalog, duplicate detection.
```

Same-origin `/v1`. Next rewrites to `API_ORIGIN` in dev. No CORS.

Auth: Firebase on the client. Admin access comes from the `admin_members` table, not from a
token claim. `oumgupta555@gmail.com` is the break-glass owner (`services/api/src/auth.ts`).
A stale `users.role = admin` does not grant access.

Catalog: `toProduct` in `apps/customer-storefront/src/context/StoreContext.tsx` maps an offer
to what the page renders. `stock` is pooled `nearbyStock`. `nearestStock` is that shop's own
count. `price` is the nearest shop's price. Checkout `POST /catalog/resolve` is the amount
that will be charged (it can add a delivery fee per dispatch and a different unit price when
quantity spills past the nearest shop). The cart figure is an estimate.

Orders: one checkout, one payment, one or more deliveries. Cancelling one delivery refunds
that delivery, not the whole checkout (`ae56f7f`).

Payments: Razorpay only. There is no Stripe code. `paymentsMode` is `razorpay` when
`RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set; the mock confirm route exists only in
mock mode. The demo has Razorpay **test** keys set in the Render dashboard (do not copy them
into git). `RAZORPAY_WEBHOOK_SECRET` is not set, so the webhook is not live. Email on the demo
is log-only. Uploads on the demo are local disk. Redis is unset on the demo. Embeddings on the
demo use the local hasher, not Bedrock.

This Next.js is not the one in older training data. Before writing Next code, read
`node_modules/next/dist/docs/` from that app. Storefront styling is Tailwind v4.

---

## Storefront, as of `075765a`

Shipped and on both remotes:

- Honest empty states: coupons, contact form, callback, datasheet/CAD when no URL, B2B PDF,
  video upload. They say the thing did not happen.
- Header, cart, and checkout talk about delivery time and pooled stock, not shop names.
- Cart drawer labels its total as an estimate.
- Hover zoom on the product image (desktop).
- Responsive header (location chip on phones, short Sign in, compact cart). Category nav is
  sticky only from `md` up. Hero arrows hide on phones; swipe changes slides.
- Search results are one line ("Results for …") instead of a banner, a category rail, and a
  green callout. `/catalog?q=` opens that search.

Then a second pass (commits `1029124` through `075765a`) expanded the product page: technical
tabs, pinout, bulk-price strip, customer reviews stored in Postgres, product-card metrics,
and more mobile layout. That pass reintroduced copy and data the honest pass had removed.
Those are open bugs, not finished work.

---

## Open bugs (confirmed in the tree at `075765a`)

Money and trust, in this order:

1. Bulk tiers are invented in `toProduct` (about 6/12/18% off) and the product page says they
   are auto-applied. Cart and checkout charge `unitPrice * quantity`.
2. Missing datasheets become `https://spaceborn.in/datasheets/{sku}.pdf`, so the product page
   and the datasheet library offer a download that was never uploaded.
3. Product cards fall back to rating 4.8 and 42 reviews. The product page always mixes in
   three hard-coded "verified" reviews (`DEFAULT_REVIEWS`) even after the API returns real ones.
4. `toProduct` also invents features, a QC certificate in the box contents, HSN `85423100`,
   GST 18% when the rate is missing, brand "Genuine Maker Grade", and a 10-minute ETA.
5. Warranty RMA sets local state and then says a BlueDart pickup was booked (`WarrantyPolicyView`).
6. B2B modal still titles itself an official proforma and shows a random quotation reference.
7. Contact and About publish Bengaluru/Pune addresses, `spaceborn.in` emails, and GSTINs
   `29AABCS9482Q1Z7` / `27AABCS9482Q1Z5` that are not from the catalog.
8. `updateQuantity` uses `stock || MAX_PER_LINE`, so stock `0` allows a quantity of 50.
9. Cart lines label `total/1.18` as "Excl." and assume 18% GST.
10. Product subtotal is nearest price times quantity, and the spill note says "dark store" /
    "adjacent hub". PIN check uses pooled stock (correct) but also says "dark store".
11. The sticky cart dock always says "10–15 Min" and free delivery over ₹500.
12. Layout: desktop hero arrows cover the first letters of the slide text. The demo Hub pill
    covers the next section title on a phone. The catalog banner says "0 Products Available"
    and "10–15 Min Delivery" while the request is still loading.

Fabrication shop names are intentional. Leave them.

---

## Security leftovers (user must do these; do not put the secrets in git)

A `gho_` GitHub token and other live keys were in `userdata.txt` and were stripped from
history with `git filter-repo`, then force-pushed. The user still needs to revoke that OAuth
token (GitHub → Settings → Applications → GitHub CLI) and rotate the Supabase and Stripe
secrets that were in the file. `gh` on this machine is logged in as GuptaOum with `repo` and
`workflow`. The GitHub MCP token is read-only and cannot push.

---

## Delivery (decided 3 Oct 2026)

Roles stay `customer`, `vendor`, and `admin` (`user_role` in `migrations/001_init.sql`). There is no delivery-driver app.

An order becomes `delivered` only when the vendor submits the customer's `handover_otp`. Admin and customer cannot make that transition (`services/api/src/orders/status.ts`). The vendor hub is the screen that collects the code. Do not weaken that check.

BlueDart is not the quick-commerce lane. Their Domestic Priority product is next-business-day air. The storefront lines that mention BlueDart (warranty RMA, contact, about, the sample order in `products.ts`) are the open honesty bugs above, not a shipping integration.

When a real shop cannot carry the parcel itself, book a hyperlocal bike and pass the existing `handover_otp` as that courier's drop OTP. Shadowfax Marketplace fits pooled shops (pickup address per order, OTP, geofence, rider GPS webhook). Borzo is the simpler on-demand alternative. Do not build that client until a shop actually needs a rider. Do not promise 10–15 minutes for a booked courier. A Spaceborn rider fleet (KYC, shifts, payouts, live dispatch) waits until a shop has its own rider and dense orders at one hub.

## What not to do

- Do not `terraform apply` or `spaceborn.ps1 up` unless the user asks.
- Do not commit `.env`, Razorpay keys, or Firebase service-account JSON.
- Do not store or repeat the user's address.
- Do not commit unless the user asks. When they do, push `origin` and `demo`.
- Do not add a delivery-driver role, a rider app, a BlueDart waybill, or a Shadowfax/Borzo client unless the user asks. The OTP close stays vendor-only.
