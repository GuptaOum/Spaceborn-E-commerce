# Spaceborn — Infrastructure & Authentication Architecture

> **Source of Truth & Project Memory**  
> Last updated: October 2026  
> Author: Spaceborn Engineering Team

---

## 1. Executive Summary

**Spaceborn** is a quick-commerce platform for electronic components, robotics parts, development boards, and on-demand digital fabrication (3D Printing & CNC machining). 

The platform operates as a monorepo (npm workspaces) with 3 client-facing frontend applications sharing a single backend API and PostgreSQL database:
1. **`customer-storefront`** (Next.js): Fast city-based electronics delivery & CAD file upload for 3D print/CNC jobs.
2. **`vendor-hub`** (Next.js): Merchant portal for electronics inventory, order fulfillment, and fabrication job quoting.
3. **`admin-panel`** (Next.js): Air-gapped back-office for vendor onboarding, catalog management, and platform oversight.

---

## 2. Infrastructure Architecture (AWS & Cloud)

```
                            [ Internet ]
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
        [ AWS CloudFront CDN ]         [ Bastion Host EC2 ]
         (Edge Caching & SSL)          (SSM Tunnel on Port 8080)
                   │                           │
                   ▼                           ▼
       [ Public ALB (Dual-Port) ]     [ Internal Admin ALB ]
      Port 80: Storefront & /v1 API   Port 80: Admin Panel & /v1 API
      Port 8080: Vendor Hub
                   │                           │
                   └─────────────┬─────────────┘
                                 │
                     [ AWS ECS Fargate Cluster ]
                     ├── storefront (Next.js)
                     ├── vendor-hub (Next.js)
                     ├── admin-panel (Next.js)
                     ├── api (Express 5 + pg)
                     └── worker (Background jobs)
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
   [ RDS PostgreSQL 16 ]  [ S3 Uploads Bucket ]  [ AWS Secrets Manager ]
   (gp3, Private Subnet)  (Encrypted CAD Files)  (Runtime App Secrets)
```

### 2.1 Networking & VPC Layout
- **VPC CIDR:** `10.20.0.0/16` across two Availability Zones (`ap-south-1a`, `ap-south-1b`).
- **3 Isolated Subnet Tiers:**
  1. **Public Tier (`10.20.0.0/24`, `10.20.1.0/24`):** Hosts the Internet Gateway, Public ALB, and NAT Gateway.
  2. **App Tier (`10.20.10.0/24`, `10.20.11.0/24`):** Private subnets hosting ECS Fargate tasks and Internal Admin ALB. Outbound traffic to the Internet routes securely via the NAT Gateway.
  3. **Database Tier (`10.20.20.0/24`, `10.20.21.0/24`):** Isolated private subnets with no Internet access, hosting RDS PostgreSQL.

### 2.2 Load Balancers & Ingress Security
- **Public ALB (`spaceborn-dev-public`):**
  - **Port 80 (HTTP / CloudFront):** Routes `/` and `/_next/*` to `customer-storefront`. Routes `/v1/*` to `api`.
  - **Port 8080 (HTTP):** Routes directly to `vendor-hub`.
  - **Strict Security Rule:** Any incoming request matching `/v1/admin/*` is **explicitly blocked (HTTP 403 Forbidden)** at the public load balancer rule level.
- **Internal Admin ALB (`spaceborn-dev-admin`):**
  - Located in private subnets with zero public IP addresses.
  - Serves `admin-panel` on Port 80 and internal `/v1/*` API routes.
  - Can **only** be accessed via an encrypted AWS Systems Manager (SSM) port-forwarding session through the Bastion EC2 host (`i-0a2072cfc13d7a3fc`).
- **AWS CloudFront Distribution:**
  - Fronts the Public ALB to provide worldwide edge caching, HTTPS termination, and DDoS protection.

### 2.3 Storage, Registry & Compute
- **AWS RDS PostgreSQL 16:**
  - `db.t4g.micro` with `gp3` encrypted storage.
  - Stores all relational data: users, stores, inventory, orders, payments, fabrication jobs, and semantic search vector embeddings.
- **AWS S3 (`spaceborn-uploads-*`):**
  - Private, KMS-encrypted, versioned bucket with public access blocked.
  - Stores customer 3D printing and CNC CAD files (STL, STEP, DXF, 3MF).
  - Configured with `force_destroy = true` for clean teardown.
- **AWS ECR:**
  - Immutable Docker container registries: `spaceborn/storefront`, `spaceborn/vendor-hub`, `spaceborn/admin-panel`, and `spaceborn/api`.
- **AWS CodeBuild (`spaceborn-build`):**
  - Builds all container images in the AWS cloud without consuming local developer CPU or memory.

### 2.4 Infrastructure Lifecycle Scripts
- **`ops/spaceborn.ps1 deploy`**: Cloud-packages source, triggers CodeBuild, updates task definitions, and performs zero-downtime rolling ECS container deployments.
- **`ops/spaceborn.ps1 tunnel -Target admin`**: Automatically boots the Bastion EC2 host and forwards `http://localhost:8080` to the private Admin ALB.
- **`ops/spaceborn.ps1 stop`**: Scales ECS tasks to 0 and stops RDS and Bastion to pause compute costs.
- **`down.sh` & `down.ps1`**: 1-click total infrastructure wipe via `terraform destroy -auto-approve`, deleting all 98 AWS cloud resources down to $0.00.

---

## 3. Authentication & Role System

Spaceborn uses **Firebase Authentication** on the client side for identity verification, paired with **PostgreSQL as the authoritative database source of truth** for roles and permissions.

```
[ User Browser / Device ]
           │
           │  1. Sign in with Google (OAuth)
           ▼
[ Firebase Authentication ]  ──> Returns JWT ID Token (uid, email, name)
           │
           │  2. Send Bearer Token with API Request
           ▼
[ Spaceborn API (/v1) ]
           │
           │  3. Verify Token & Resolve Role
           ▼
┌────────────────────────────────────────────────────────┐
│ Role Resolution Hierarchy:                             │
│ 1. Developer Whitelist (oumgupta555@gmail.com -> admin)│
│ 2. PostgreSQL `users.role` (Postgres Database Record)  │
│ 3. Firebase Custom Claim `token.role`                  │
│ 4. Fallback Default: 'customer'                        │
└────────────────────────────────────────────────────────┘
```

---

## 4. How Each Role Signs In & Operates

### 4.1 Customer (`role = 'customer'`)
- **Access Point:**
  - Production: `https://d2w4nxdybzrkls.cloudfront.net`
  - Local Dev: `http://localhost:3000`
- **Who Signs In:** General buyers, engineers, makers, and students.
- **Sign-In Method:**
  - Clicks **Sign in with Google** (or Email/Password) via Firebase UI.
- **Role Assignment:**
  - Any standard user signing in defaults to `role = 'customer'`.
  - Automatically synced to PostgreSQL `users` table via `syncUser()` on first authenticated request.
- **Capabilities:**
  - Select city / location (e.g. Kanpur, Bengaluru, Chennai, Pune).
  - Browse local catalog with real-time stock and instant delivery ETA.
  - Place multi-item orders with Razorpay checkout.
  - Upload CAD files (STL, STEP, DXF) to request custom 3D printing or CNC machining quotes.
  - Track active orders and view the private 4-digit Delivery Verification OTP.

---

### 4.2 Vendor / Seller (`role = 'vendor'`)
- **Access Point:**
  - Production: `http://spaceborn-dev-public-23263253.ap-south-1.elb.amazonaws.com:8080`
  - Local Dev: `http://localhost:3001`
- **Who Signs In:** Local electronics shops, component distributors, and 3D printing/CNC workshops.
- **Sign-In Method:**
  - Clicks **Sign in with Google** or logs in with email.
- **Role Assignment & Store Association:**
  - A vendor must be associated with an approved store record in the PostgreSQL `stores` table:
    ```sql
    select id from stores where owner_id = $uid and status = 'approved';
    ```
  - When a seller logs in without a store, the Vendor Hub presents a **"Register Your Store"** application form.
  - Once the application is approved by an Admin, the seller's session gains `role = 'vendor'` and `storeId = '<uuid>'`.
- **Identity & Fraud-Prevention Rule:**
  - An Admin identity **cannot** operate a Vendor store under the exact same email address (`role = 'admin'` takes precedence).
  - **Testing as a Vendor:** Developers should sign in with a Gmail alias:
    `oumgupta555+vendor@gmail.com`
    All verification emails will still route to your primary `oumgupta555@gmail.com` inbox, but the platform treats it as an independent vendor merchant identity.
- **Capabilities:**
  - Manage product inventory, stock levels, and city pricing.
  - View incoming electronics orders and mark them as packed / dispatched.
  - Review customer 3D printing & CNC requests, inspect CAD specs, and issue custom INR price quotes.
  - Input the customer's delivery OTP to complete orders and release funds.

---

### 4.3 Administrator (`role = 'admin'`)
- **Access Point (Air-Gapped & Tunnel Protected):**
  - Production: `http://localhost:8080` *(via AWS SSM Bastion Port-Forwarding Tunnel)*
  - Local Dev: `http://localhost:3002`
- **How to Connect (Windows):**
  1. Open PowerShell:
     ```powershell
     cd D:\spacebornecomm\Spaceborn-E-commerce
     .\ops\spaceborn.ps1 tunnel -Target admin
     ```
  2. The script boots the Bastion EC2 host if stopped and forwards `http://localhost:8080` directly to the private Internal Admin ALB.
  3. Open your browser to `http://localhost:8080`.
- **Sign-In Method:**
  - Clicks **Sign in with Google** and selects `oumgupta555@gmail.com`.
- **Dual-Layer Authorization Engine:**
  To guarantee that administrators are never locked out even if third-party Firebase Admin credentials are unset:
  1. **Frontend Guard (`apps/admin-panel` & `packages/web-core`):**
     - Contains `DEFAULT_ADMIN_EMAILS = ['oumgupta555@gmail.com']`.
     - Automatically elevates matching sessions to `role = 'admin'`.
  2. **Backend API Guard (`services/api/src/auth.ts`):**
     - `requireAdmin` middleware checks token email and PostgreSQL `users.role`.
     - If email matches `oumgupta555@gmail.com`, it bypasses claim latency and grants instant administrative clearance.
     - Decoupled from `FIREBASE_SERVICE_ACCOUNT_JSON` so it never crashes with credential errors.
- **Capabilities:**
  - **Store Applications Tab:** Review and approve/reject new vendor onboardings.
  - **Print & CNC Services Tab:** Audit and approve fabrication capability listings.
  - **Orders Tab:** Global platform-wide order monitor and manual interventions.
  - **Print Jobs Tab:** Inspect CAD files and review vendor quotes.
  - **Master Catalog Tab:** Add/edit products, specifications, categories, and reference images.

---

## 5. Quick Reference Matrix

| Feature | Customer Storefront | Vendor Hub | Admin Panel |
| :--- | :--- | :--- | :--- |
| **Target User** | Buyers & Makers | Store Owners & Machinists | Platform Administrators |
| **Network Path** | CloudFront CDN / Public ALB | Public ALB Port 8080 | Internal ALB via SSM Tunnel |
| **Default Port** | `3000` | `3001` (ALB: `8080`) | `3002` (Tunnel: `8080`) |
| **Auth Provider** | Firebase Auth (Google) | Firebase Auth (Google) | Firebase Auth (Google) |
| **Primary Identifier**| Any email | Store Owner Email (`+alias` for dev)| `oumgupta555@gmail.com` |
| **Authoritative Check**| PostgreSQL `users` | PostgreSQL `stores.owner_id` | PostgreSQL `users.role` + Whitelist |
| **Access Gating** | Open to public | Approved Store required | Admin role + Tunnel required |
| **Sensitive Routes** | Public `/v1/*` | `/v1/vendor/*` | `/v1/admin/*` (Strictly internal) |
