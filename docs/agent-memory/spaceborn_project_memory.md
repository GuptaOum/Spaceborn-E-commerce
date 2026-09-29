# Spaceborn Project Memory & Status Report

## 🎯 The Original Vision (What We Desired)
The goal was to build **Spaceborn**, a highly scalable, multi-sided quick-commerce platform engineered specifically for electronics and components, modeled after the robust architectures of giants like Swiggy, Zomato, and Blinkit.

**Key Requirements:**
1. **Multi-Persona Separation:** Three distinct applications for Customers, Vendors, and Admins.
2. **Bulletproof RBAC:** Strict Role-Based Access Control so vendors cannot access admin tools, and customers cannot access vendor tools.
3. **Enterprise Quick-Commerce Backend:** Prevent inventory race conditions (overselling) during flash sales and ensure lightning-fast checkout responses.
4. **Secure Cloud Infrastructure:** Move away from local monoliths to a secure AWS VPC architecture where internal tools (Admin Panel) are hidden from the public internet.

---

## ✅ Current State (What Is Done Right Now)

We have successfully transformed the project from a local monolithic frontend into a fully deployed, cloud-native microservices architecture on AWS.

### 1. Monorepo & Frontend Applications
- Split the codebase into three independent Next.js applications running concurrently on AWS:
  - `apps/customer-storefront` (Port 3000)
  - `apps/vendor-hub` (Port 3001)
  - `apps/admin-panel` (Port 3002)

### 2. Security & Strict RBAC
- **Firebase Auth + Custom Claims:** User identities are verified, and custom claims (`admin`, `vendor`) are injected via the Admin SDK (`setAdminClaim.js`).
- **Next.js Edge Middleware:** All routes in the Admin and Vendor apps are protected by Edge middleware (`middleware.ts`). It strictly verifies the JWT signature and claims before rendering pages.
- **HTTP-Only Cookies:** Tokens are securely passed from the client to the server via Next.js API routes (`/api/login`, `/api/logout`) to prevent XSS attacks.
- **Supabase RLS:** Database Row-Level Security (RLS) is mapped out to ensure users can only query their own data.

### 3. Zomato/Swiggy Backend Architecture
To solve the quick-commerce scaling problem, we built an asynchronous processing pipeline:
- **Message Broker (RabbitMQ):** Dockerized on AWS. The `customer-storefront` checkout API instantly pushes the order payload to a queue and returns a success response to the user in milliseconds.
- **Distributed Locking (Redis):** Dockerized on AWS. 
- **Order Processor Microservice:** A standalone Node.js worker (`apps/order-processor`) continuously consumes the RabbitMQ queue. It uses **Redlock** (Redis) to lock specific items, safely decrements inventory in Supabase, and updates the order status without race conditions.

### 4. Cloud Infrastructure & Remote Execution
- **AWS VPC:** All execution happens on an AWS EC2 `t3.large` instance in `ap-south-1`. Local `node_modules` were wiped out to keep the local Git workspace pristine.
- **Zero-Trust Network:** The Admin Panel is completely hidden from the public internet. It is exposed via a secure outbound `cloudflared` tunnel, blocking all inbound DDoS and port scanning attempts.

---

## 🚀 Next Steps / Pending Items
While the core architecture is live, here is what needs attention next when development resumes:

### 1. Environment Variables Injection
The AWS EC2 instance is currently running the Node.js worker, but it requires your **Supabase Service Role Key** (bypassing RLS for backend tasks) to be actively injected into the environment. 
*Action required:* You need to SSH into the instance and provide the secret key to the worker process.

### 2. Vendor Approval Flow Integration
The UI for vendors registering and admins approving them exists, but the database triggers to automatically assign the `vendor` Firebase custom claim upon Admin approval need to be finalized.

### 3. CI/CD Pipeline
Currently, deployment is handled via manual `scp` and `ssh` commands. A GitHub Actions pipeline should be established to automate testing and deployment to the EC2 instance upon pushing to `main`.

---

## 📌 How to Resume Work
Because all heavy execution happens remotely:
1. **Edit Code Locally:** Write your code in your local IDE.
2. **Sync to AWS:** Use SCP or Git to push the lightweight source code files to the EC2 instance.
3. **Run on AWS:** SSH into `ec2-user@35.154.243.128` to run `npm install` and restart the PM2/Nohup Next.js processes.
