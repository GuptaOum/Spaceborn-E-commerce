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

## 🔑 Key Identities & Portals

| Role | Production Entry Point | Login Method | Authorized Email |
| :--- | :--- | :--- | :--- |
| **Customer** | `https://d2w4nxdybzrkls.cloudfront.net` | Google Sign-In | Any Google account |
| **Vendor** | Public ALB Port `8080` | Google / Email | `oumgupta555+vendor@gmail.com` *(use alias)* |
| **Admin** | `http://localhost:8080` *(via SSM tunnel)* | Google Sign-In | `oumgupta555@gmail.com` *(Hardcoded Admin)* |
