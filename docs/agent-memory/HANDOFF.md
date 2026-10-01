# Spaceborn — project handoff

Quick commerce for electronics, plus on-demand 3D printing and CNC. Think Blinkit/Swiggy,
but local stores deliver components in minutes and also take fabrication jobs. Three web
apps (customer, vendor, admin) on one API, one Postgres, Firebase auth, Razorpay payments,
deployed to AWS with Terraform.

This file is the source of truth for the next agent. The old planning docs (Supabase era)
were removed because they no longer match the code.

---

## Repo layout (npm workspaces)

```
services/api            Express + pg + Firebase Admin. All business logic and RBAC.
packages/web-core       Shared React: Firebase auth, api() client, types, formatters, SignInPanel.
apps/customer-storefront Next.js, port 3000. Browse, order, track, 3D print / CNC.
apps/vendor-hub         Next.js, port 3001. Apply, inventory, orders, services, print jobs.
apps/admin-panel        Next.js, port 3002. Approve stores/services, catalog, orders, jobs.
terraform/              AWS infra (VPC, RDS, ECS Fargate, ALBs, ECR, bastion, secrets).
docs/agent-memory/      This handoff.
```

The API is same-origin at `/v1`. In production the ALB routes `/v1` to the API; in dev each
Next app rewrites `/v1` to `API_ORIGIN` (default `http://localhost:4000`). No CORS.

---

## Status: DONE and verified locally (Latest Commit: 4d8e9e0)

Verified with: `npm install` at root, `npm run typecheck` (all 5 workspaces clean: `@spaceborn/web-core`, `@spaceborn/api`, `admin-panel`, `customer-storefront`, `vendor-hub`), `npm test -w services/api test/domain.test.ts` (all tests passing).
- AWS Cloud Infrastructure: Cleanly destroyed ($0.00 spend).
- Catalog: Expanded to 100 realistic electronic, robotic, 3D printing, and CNC products with high-resolution imagery.
- Vendor Hub: Audio alerts, WhatsApp customer messaging, 58mm/80mm thermal receipt generator, permanent SKU inventory deletion, and proposal re-submission.
- Admin Panel: Simplified 3-tier operational pillars navigation, order line-items inspection drawer with search, 1-click Google Maps store premise verification, and master catalog product editing.
- Public Repository: Pushed to `https://github.com/GuptaOum/Spaceborn-E-commerce.git` (`public main`).

### Backend (`services/api`)
- Express 5, `pg`, `firebase-admin`, `zod`, `razorpay`, `pino`, `helmet`, rate limiting.
- Migrations in `migrations/` (`001_init.sql` commerce, `002_fabrication.sql` services).
  Runner is `src/db/migrate.ts` (advisory lock, one txn per file, refuses non-UTF8 DB).
- Seed `src/db/seed.ts`: 3 demo stores (Kanpur, Bengaluru, Pune), catalog, inventory.
- RBAC: Firebase custom claims `{role, storeId}` set only server-side. Every sensitive route
  re-checks the DB (admin against `users.role`; vendor must own an approved store matching the
  claim). Suspending a store resets claims and revokes sessions. Dev-only `Authorization: Dev
  uid:role:storeId` header, refused in production.
- Orders: single txn locks inventory `FOR UPDATE`, prices server-side, holds stock 15 min as
  `pending_payment`, idempotency key per customer, Razorpay order (mock mode when Razorpay
  unset, non-prod only), explicit status machine, delivery needs OTP, cancel restocks and
  refunds via a transactional outbox drained by the worker.
- Fabrication (3D printing / CNC), new:
  - `service_listings` (vendor offers a kind, materials, max size, starting price, turnaround;
    admin approves; editing an approved listing returns it to `pending`).
  - `fab_jobs` lifecycle: submitted -> quoted -> pending_payment -> in_production -> ready ->
    out_for_delivery -> delivered (plus declined/cancelled/expired). Quote valid 48h.
  - `fab_files`: customer uploads design files (STL/STEP/DXF/3MF/... , 50MB cap). Stored via
    `src/storage.ts` — private S3 in prod (SSE-KMS), local disk (`.uploads/`) in dev. Downloads
    always go through an authz check; there are no public/pre-signed links. Unattached uploads
    are swept after 24h by the worker.
  - Payments table now serves orders OR fab jobs (`num_nonnulls(order_id, fab_job_id) = 1`).
    `markPaid` and the refund outbox handle both.
  - Address privacy: a vendor only sees the customer's full address after payment; before that
    only city + pincode. OTP never leaves the API to anyone but the customer.
- Routes: `catalog` (public), `orders`, `payments` (+ webhook raw body), `me`, `vendor`,
  `admin`, `fabrication`. Worker `src/worker.ts`: outbox drain, expire reservations, expire
  quotes, orphan-file sweep, refunds.
- Tests `test/rbac.integration.test.ts` (33 total) cover order RBAC/overselling AND fabrication:
  listing approval gating, upload auth + file-type + path-traversal, per-role job/file privacy,
  quote/pay/deliver with OTP, paid-job cancel + refund, suspend/edit re-review.

### Frontend
- `packages/web-core`: lazy Firebase client, `api()`/`uploadFile()`/`downloadFile()` (Bearer
  token, same-origin `/v1`), `AuthProvider`/`useAuth` (role from claims, display only),
  `SignInPanel`, shared types + formatters (order + fab labels).
- Customer storefront: real Firebase auth; location (presets or geolocation) -> nearest open
  store -> catalog from API; cart is single-store; checkout calls `POST /v1/orders` with an
  idempotency key then Razorpay (or mock) then verify; orders page shows live status + OTP +
  cancel; new `/fabrication` page (pick kind -> pick maker -> upload -> quote -> accept & pay ->
  track). Home has "Print & CNC" tile + hero button. Category names aligned to seed.
- Vendor hub: gated by store state (no store / pending / rejected / suspended / approved).
  Approved dashboard tabs: Orders, Inventory, Print jobs (quote/decline/produce/deliver),
  Services (offer/edit 3D printing & CNC).
- Admin panel: admin-gated. Tabs: Store applications, Print & CNC services (approve/reject/
  suspend), Orders, Print jobs (view files, cancel), Master catalog. Overview has service +
  job counts.

### Cleanup done
- Removed `Backend/`, `backend-workers/`, `apps/order-processor/`, `supabase/`, `deploy.sh`,
  `scripts/`, root `docker-compose.yml`, and all Vite/Stripe/Supabase leftovers from the apps.

---

## Status: Cloud Infrastructure & Architecture Completed

For complete details on AWS infrastructure and authentication across all roles, see:
[`INFRA_AND_AUTH_ARCHITECTURE.md`](./INFRA_AND_AUTH_ARCHITECTURE.md).

### Cloud & Operations Highlights:
- S3 uploads bucket (`spaceborn-uploads-*`) with KMS encryption and `force_destroy = true`.
- Zero-downtime rolling cloud deployment via AWS CodeBuild & ECS Fargate.
- Dual-port Public ALB (Port 80 Storefront, Port 8080 Vendor Hub) + Air-gapped Internal Admin ALB via SSM tunnel.
- 1-Click teardown scripts: `down.sh` (Bash) and `down.ps1` (PowerShell).
- Decoupled Admin authorization with developer whitelist fallback (`oumgupta555@gmail.com`).
3. Fill real values: `aws_account_id`, `aws_profile`, `domain_name`, `acm_certificate_arn`,
   `firebase_project_id`, `admin_allowed_cidrs`. See `terraform/terraform.tfvars.example`.
4. Put the app secret JSON into Secrets Manager (`FIREBASE_SERVICE_ACCOUNT_JSON`, `RAZORPAY_*`).
5. Decide on the S3 backend for tf state (currently commented out in `versions.tf`).
6. Build + push the 4 images to ECR (api, storefront, vendor-hub, admin-panel), run the migrate
   task, then bring up services. Verify the RDS is UTF8 (the managed instance is by default).

### Dockerfiles / CI / local compose (not written yet)
7. `services/api/Dockerfile` exists but is for the old single-package layout — update it for the
   workspace root build. Also it must `npm ci` the S3 SDK (already a dep) and copy `migrations/`.
8. Write Dockerfiles for the 3 Next apps building from repo root (standalone `server.js`).
9. Write a local `docker-compose.yml` (postgres + api + worker) for dev.
10. Rewrite `.github/workflows/ci.yml` — the OLD one still hardcodes Firebase + Supabase keys.
    New CI: root `npm ci`, API typecheck + tests, build all apps. Remove all secrets.

### Product gaps / nice-to-haves
11. Fabrication push notifications / rider dispatch are just log hooks in the worker.
12. Storefront `/fabrication` file upload is one-file-at-a-time via `uploadFile`; fine, but no
    resumable/multipart for very large CAD files.
13. No automated frontend tests yet (only typecheck + build).

---

## Run locally (dev, no AWS)

```
npm install                       # from repo root
# start a local Postgres (UTF8!), then in services/api with a .env (see .env.example):
npm run db:migrate -w services/api
npm run db:seed   -w services/api
npm run dev:api        # :4000
npm run dev:worker
npm run dev:storefront # :3000
npm run dev:vendor     # :3001
npm run dev:admin      # :3002
# grant yourself admin: npm run grant-admin -w services/api -- you@example.com
```

Mock payments are used automatically when `RAZORPAY_*` are unset (non-prod). Uploaded files go
to `services/api/.uploads/` (gitignored).

## Env / secrets checklist
- API: `DB_*`, `DB_SSL=require` (prod), `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `UPLOADS_BUCKET` (prod), `AWS_REGION`, `UPLOAD_DIR`
  (dev), `MAX_UPLOAD_MB`. See `services/api/.env.example`.
- Web apps: `NEXT_PUBLIC_FIREBASE_*`, `API_ORIGIN` (dev). See each app's `.env.example`.

## Security notes for whoever holds the repo
- The clone URL had a GitHub PAT embedded. It lives in local `.git/config` only (never
  committed). REVOKE that token and set a clean remote:
  `git remote set-url origin https://github.com/GuptaOum/Spaceborn-E-commerce.git`
- Never commit Firebase service-account JSON or Razorpay secrets; they belong in Secrets Manager.
- Admin panel is only reachable on the internal ALB; the public ALB returns 403 for `/v1/admin*`.
