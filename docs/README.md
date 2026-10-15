# Spaceborn Documentation Hub

Welcome to the **Spaceborn Documentation Hub**. This directory contains the complete source of truth, operational guides, and architectural references for the platform.

---

## 📚 Document Index

### 🚀 Getting Started on a New Computer
- [**`NEW_MACHINE_SETUP.md`**](./NEW_MACHINE_SETUP.md)  
  *Read this first if setting up a new computer tomorrow!*  
  Covers software prerequisites (Node.js, Git, AWS CLI, SSM Plugin, Terraform), cloning, local development, running tests, and connecting to AWS.

### 🏛️ Complete System Architecture & Deep Dive
- [**`FULL_SYSTEM_REFERENCE.md`**](./FULL_SYSTEM_REFERENCE.md)  
  The definitive technical manual: monorepo workspaces, PostgreSQL schema, 100-item catalog across 4 cities, security model, and AWS resource specifications.

### 🛡️ Authentication & Role Breakdown
- [**`agent-memory/INFRA_AND_AUTH_ARCHITECTURE.md`**](./agent-memory/INFRA_AND_AUTH_ARCHITECTURE.md)  
  Detailed guide on how **Customer**, **Vendor**, and **Admin** authenticate, sign-in endpoints, Air-Gapped SSM tunnel access, and developer whitelist fallback logic.

### 📋 Project Memory & Handoff
- [**`agent-memory/HANDOFF.md`**](./agent-memory/HANDOFF.md)  
  Engineering context, business decisions, and evolutionary history of the platform.

### 🗺️ Visual Architecture Diagram
- [**`architecture.svg`**](./architecture.svg)  
  High-resolution SVG diagram of the 4-tier AWS infrastructure layout.

---

## ⚡ Quick Command Reference

| Task | Command |
| :--- | :--- |
| **Install Dependencies** | `npm install` |
| **Run Locally** | `npm run dev` *(Storefront: 3000, Vendor: 3001, Admin: 3002, API: 4000)* |
| **Verify Code** | `npm run typecheck` |
| **Admin SSM Tunnel** | `powershell -File .\ops\spaceborn.ps1 tunnel -Target admin` |
| **Deploy to AWS** | `powershell -File .\ops\spaceborn.ps1 deploy` |
| **Pause AWS Services** | `powershell -File .\ops\spaceborn.ps1 stop` |
| **Total Cloud Teardown** | `powershell -File .\down.ps1` *(or `./down.sh` on Linux/macOS)* |

---

## 🔑 Where it runs

Current detail is in [`agent-memory/HANDOFF.md`](./agent-memory/HANDOFF.md) (updated 3 Oct 2026). The live site is the Render demo. Production AWS is parked: DNS for `elbotrob.me` is on Route 53, and the CloudFront distributions are disabled until `ops/spaceborn.ps1 up`.

| Surface | Entry | Notes |
| :--- | :--- | :--- |
| **Customer, vendor, admin (demo)** | `https://spacebornecomdemo-1.onrender.com` | One container. `?app=store\|vendor\|admin` switches the app. |
| **Customer (AWS, not live)** | `https://d1my794d3ygm15.cloudfront.net` | Storefront and `/v1`. Do not recreate this distribution. |
| **Vendor (AWS, not live)** | `https://d2zizda8lkhnw6.cloudfront.net` | Vendor hub. |
| **Admin (AWS)** | SSM tunnel, then the internal admin ALB | Access is the `admin_members` table. `oumgupta555@gmail.com` is the break-glass owner. |
| **Customer (domain)** | `https://elbotrob.me` | Nameservers are Route 53. The site answers only after `ops/spaceborn.ps1 up` re-enables CloudFront. |
