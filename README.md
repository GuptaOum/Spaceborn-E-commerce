# Spaceborn — Distributed Quick-Commerce & Hardware Fabrication Platform

> **Location-first quick commerce for robotics, embedded electronics, and custom on-demand 3D printing & CNC fabrication.**

[![AWS Architecture](https://img.shields.io/badge/AWS-Architecture_Verified-232F3E?logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![Next.js 16](https://img.shields.io/badge/Next.js-16_Turbopack-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16_Multi--AZ-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Terraform](https://img.shields.io/badge/Terraform-1.10_IaC-844FBA?logo=terraform&logoColor=white)](https://www.terraform.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

## 🏛️ System Architecture

Spaceborn is designed as a cloud-native, multi-tier distributed system running in AWS region `ap-south-1` (Mumbai). It enforces a **Zero-Trust network perimeter**, where public ingress is strictly isolated from internal microservices, asynchronous workers, and persistent databases.

![Spaceborn Production Architecture](docs/architecture.svg)

---

### Network & Infrastructure Topology

```
                                  [ INTERNET ]
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
      [Customers]                   [Vendors]                 [Administrators]
   (Public Storefront)             (Vendor Hub)              (SSM Session Only)
           │                            │                            │
           ▼                            ▼                            │
┌────────────────────────────────────────────────────────┐           │
│  AWS CloudFront CDN Edge Cache (PriceClass_200)        │           │
│  • Edge PoPs: Mumbai, Chennai, Hyderabad               │           │
│  • HTTPS Termination & Next.js Asset Caching           │           │
└───────────────────────────────┬────────────────────────┘           │
                                │                                    │
                                ▼                                    │
┌────────────────────────────────────────────────────────────────────┼────────┐
│  AWS VPC (10.20.0.0/16)                                            │        │
│                                                                    │        │
│  ┌──────────────────────────────────────────────────────────────┐  │        │
│  │  PUBLIC SUBNETS (10.20.0.0/24 & 10.20.1.0/24)                │  │        │
│  │                                                              │  │        │
│  │   Internet-Facing Application Load Balancer (ALB)            │  │        │
│  │   ├── Port 80   ──► Next.js Storefront Container             │  │        │
│  │   ├── Port 8080 ──► Next.js Vendor Hub Container             │  │        │
│  │   └── /v1/*     ──► Express API Container                    │  │        │
│  │   (Note: /v1/admin* automatically rejected with 403)         │  │        │
│  │                                                              │  │        │
│  │   Shared NAT Gateway (Zone 1a)  │  S3 Gateway Endpoint       │  │        │
│  └──────────────────┬──────────────────────────┬────────────────┘  │        │
│                     │                          │                   │        │
│  ┌──────────────────▼──────────────────────────▼────────────────┐  │        │
│  │  PRIVATE APPLICATION SUBNETS (10.20.10.0/24 & 10.20.11.0/24) │  │        │
│  │                                                              │  │        │
│  │  ECS Fargate Cluster:                                        │  │        │
│  │  ├── customer-storefront (Next.js 16 Standalone :3000)       │  │        │
│  │  ├── vendor-hub          (Next.js 16 Standalone :3000)       │  │        │
│  │  ├── spaceborn-api       (Node.js / Express :4000)           │  │        │
│  │  └── outbox-worker       (Event bus, refunds, transactional) │  │        │
│  │                                                              │  │        │
│  │  Internal ALB (Non-Internet Facing):                         │  │        │
│  │  └── admin-panel         (Next.js 16 Standalone :3000)       │  │        │
│  │                                                              │  │        │
│  │  Bastion Host (t4g.nano):                                    │  │        │
│  │  └── AWS Systems Manager (SSM Session Manager only, no SSH) ◄┼──────────┘
│  └──────────────────┬───────────────────────────────────────────┘
│                     │
│  ┌──────────────────▼───────────────────────────────────────────┐
│  │  ISOLATED DATABASE SUBNETS (10.20.20.0/24 & 10.20.21.0/24)    │
│  │  (Zero Internet Egress / Strict Security Group Ingress)      │
│  │                                                              │
│  │  AWS RDS PostgreSQL 16 (Multi-AZ Ready)                      │
│  │  • Enforced SSL/TLS In-Transit & AES-256 At-Rest Encryption   │
│  │  • Master credentials auto-rotated via AWS Secrets Manager    │
│  └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Key Architectural Pillars

### 1. Dual-ALB Network Segmentation
- **Public Ingress ALB:** Handles public internet traffic across Availability Zones `ap-south-1a` and `ap-south-1b`. Routes customer traffic to the storefront (`:80`), vendor traffic to the vendor hub (`:8080`), and business API calls to `/v1/*`. Any external request hitting `/v1/admin*` is blocked at the ALB listener rule with a strict `403 Forbidden`.
- **Internal Private ALB:** The **Admin Panel** is physically inaccessible from the internet. It resides in the private subnet behind an internal load balancer, accessible only via secure VPC peering, AWS VPN, or via port-forwarding through the SSM-managed bastion host.

### 2. Zero-Trust Access & Bastion Architecture
- **No Public SSH:** The EC2 Bastion (`t4g.nano`) has **no public IP address** and **no open port 22**.
- **IAM Identity-Based Access:** Administrative access is granted exclusively through AWS Systems Manager (`aws ssm start-session`), generating ephemeral credentials audited in AWS CloudTrail.

### 3. Server-Enforced Location-First Routing
- Store selection is **never trusted to the client**.
- Delivery coordinates dictate fulfillment ranking based on real-time inventory, store operating status, and physical proximity to guarantee < 15-minute fulfillment SLAs.

### 4. Resilient Asynchronous Worker & Outbox Pattern
- Transactional mutations write domain events to an ACID **Transactional Outbox Table** within the same PostgreSQL transaction.
- A dedicated background ECS Fargate worker continuously polls and distributes events to:
  - **Amazon SES:** Delivers 4-digit handover OTPs and vendor dispatch alerts.
  - **Razorpay Reconciliation:** Reconciles order payments and handles idempotent auto-refunds on inventory race conditions.

### 5. High-Performance Image Optimization
- Next.js 16 Image Optimization API (`next/image`) dynamically fetches, resizes, and compresses source images to modern **AVIF / WebP** formats.
- CloudFront edge caches static assets (`/_next/static/*`) and image requests, eliminating repetitive backend compute.
- Custom vendor uploads (CAD / STL 3D models and CNC specifications) are streamed directly to private, encrypted S3 buckets via pre-signed URLs.

---

## 📦 Monorepo Directory Structure

```
Spaceborn-E-commerce/
├── apps/
│   ├── customer-storefront/  # Customer quick-commerce shopping web app (Next.js 16)
│   ├── vendor-hub/           # Seller order management & stock management portal (Next.js 16)
│   └── admin-panel/          # Platform telemetry, inventory governance & audit dashboard (Next.js 16)
├── services/
│   └── api/                  # Core REST API & Asynchronous Outbox Worker (Express + Node.js)
│       ├── migrations/       # PostgreSQL schema migrations
│       └── src/
│           ├── db/           # Connection pool & 55-product seed catalog
│           ├── orders/       # Order state machine & fulfillment logic
│           └── payments/     # Razorpay integration & webhook handlers
├── packages/
│   └── web-core/             # Shared TypeScript types, API clients, and UI design primitives
├── ops/
│   └── spaceborn.ps1         # Unified operational CLI (build, test, deploy, migrate)
├── terraform/                # Production AWS Infrastructure-as-Code (ap-south-1)
└── docs/
    └── architecture.svg      # Official AWS Architecture Diagram
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x+`
- **PostgreSQL**: `v16.x` (or Docker)

### 1. Installation
Clone the repository and install dependencies at the monorepo root:
```bash
git clone https://github.com/Spaceborn-Beyond-Autonomous/Spaceborn-E-commerce.git
cd Spaceborn-E-commerce
npm install
```

### 2. Configure Environment
Copy the example environment templates:
```bash
cp services/api/.env.example services/api/.env
```

### 3. Running Services Locally
Start services individually or in parallel using npm workspaces:

| Service | Port | Command |
|---|---|---|
| **Core API Backend** | `4000` | `npm run dev:api` |
| **Customer Storefront** | `3000` | `npm run dev:storefront` |
| **Vendor Hub** | `3001` | `npm run dev:vendor` |
| **Admin Panel** | `3002` | `npm run dev:admin` |
| **Background Outbox Worker**| N/A | `npm run dev:worker` |

---

## 🧪 Testing & Verification

Run the comprehensive TypeScript compilation and test suites:

```bash
# Typecheck all monorepo workspaces
npm run typecheck

# Run domain, fulfillment, and RBAC integration tests
npm test
```

---

## 📜 Infrastructure Governance

The production environment is provisioned with high-availability safeguards:
- **RDS Multi-AZ**: High-availability database replication with automatic failover.
- **Accidental Deletion Shield**: `deletion_protection = true` and `skip_final_snapshot = false` enforced on all persistent databases.
- **Immutable Container Tags**: ECR images are pinned and scanned on push using AWS Inspector.

---
*Built with precision for Spaceborn.*