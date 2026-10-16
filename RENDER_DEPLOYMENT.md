# 🚀 Spaceborn — $0 Zero-Cost Deployment Guide (Render + Supabase + Firebase)

This guide walks you through deploying the complete **Spaceborn Quick-Commerce & Fabrication Platform** (Customer Storefront, Vendor Hub, Admin Panel, and Express API) to **Render** at **$0.00 / month cost**.

---

## 🏗️ The 0-Dollar Architecture

| Component | Free Tier Provider | Limits & Details | Cost |
| :--- | :--- | :--- | :--- |
| **Compute & Web Services** | [Render](https://render.com) | Free Web Service (512 MB RAM, 750 free instance hours/month) | **$0.00** |
| **PostgreSQL Database** | [Supabase](https://supabase.com) | 500 MB Postgres 15+, pgvector, PgBouncer pooler on port 6543 | **$0.00** |
| **Authentication & RBAC** | [Firebase Auth](https://firebase.google.com) | Spark Plan: 50,000 monthly active users, custom claims | **$0.00** |
| **CAD File Storage** | Render Local Disk / Supabase | Stored in local directory (`.uploads`) with `UPLOADS_ALLOW_LOCAL=true` | **$0.00** |
| **Payment Gateway** | Internal Mock Engine | Pre-configured simulation engine (`PAYMENTS_ALLOW_MOCK=true`) | **$0.00** |

---

## ⚡ Deployment Options (Choose Your Blueprint)

We provide **two** Render blueprint specifications:

1. **Option A: Unified Gateway (`render.unified.yaml`) — [RECOMMENDED]**
   - **Cost:** **100% Free Forever ($0.00)**.
   - Runs all 4 microservices cooperatively behind `scripts/render-gateway.mjs` inside **1 single container**.
   - Consumes exactly 720 hours/month $\le$ 750 free hours limit.
   - Includes interactive Demo Hub (`/__portal`), floating switcher bar, and subdomain/cookie routing.
2. **Option B: 4 Separate Microservices (`render.yaml`)**
   - Deploys 4 distinct Web Services (`spaceborn-api`, `spaceborn-storefront`, `spaceborn-vendor-hub`, `spaceborn-admin-panel`).
   - Each service has its own unique Render URL.
   - *Note:* Having 4 separate services running concurrently will consume free instance hours faster if not spun down during idle periods.

---

## Step 1: Create Your New GitHub Repository

Create a fresh GitHub repository (e.g. `spacebornecomdemo`) and push the codebase:

```bash
# In your local project directory (d:\spacebornecomm\Spaceborn-E-commerce):
git init
git add .
git commit -m "feat: configure $0 cost Render Blueprint deployment"

# Set remote to your new repository:
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/spacebornecomdemo.git
git branch -M main
git push -u origin main
```

---

## Step 2: Set Up Free Supabase Database

1. Go to [database.new](https://database.new) and create a new Supabase project (e.g., `spaceborn-demo`).
2. Set a strong database password and choose the closest region.
3. Once provisioned, go to **Project Settings** $\rightarrow$ **Database** $\rightarrow$ **Connection string**:
   - Select **URI** and choose **Session pooler** or **Transaction pooler** (Port `6543` or Direct `5432`).
   - Format:
     ```text
     postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
     ```
   - Keep this connection string ready as your `DATABASE_URL`.

### Run Migrations & Initial Seed Data

You can apply the schema migrations and catalog seed in one command from your machine:

```bash
# From local project root:
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require" npm run db:migrate -w services/api

DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require" npm run db:seed -w services/api
```

*(Note: When using the Unified Blueprint `render.unified.yaml`, the gateway runner also checks and applies migrations automatically upon container boot!)*

---

## Step 3: Set Up Free Firebase Authentication

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project (e.g., `spaceborn-demo`).
2. **Enable Authentication**:
   - Go to **Build** $\rightarrow$ **Authentication** $\rightarrow$ **Get Started**.
   - Under **Sign-in method**, enable **Email/Password** (and optionally **Google**).
3. **Get Client Web SDK Keys**:
   - Click the gear icon $\rightarrow$ **Project Settings** $\rightarrow$ **General**.
   - Scroll to **Your apps**, click **Web (`</>`)**, and register the app (e.g. `spaceborn-web`).
   - Note the configuration values:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
4. **Get Firebase Admin Service Account JSON**:
   - In **Project Settings**, switch to the **Service accounts** tab.
   - Click **Generate new private key** and download the JSON file.
   - Convert the JSON into a **single line string** (escape newlines in `private_key` as `\n`). This will be your `FIREBASE_SERVICE_ACCOUNT_JSON`.

---

## Step 4: Deploy on Render via 1-Click Blueprints

1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** at the top right and select **Blueprint**.
3. Connect your GitHub account and select your repository (`spacebornecomdemo`).
4. Choose your Blueprint file:
   - **To use 1 Unified Free Service ($0 perpetually):**
     In Blueprint settings, specify `render.unified.yaml`.
   - **To use 4 Separate Services:**
     Leave as default `render.yaml`.
5. Render will detect the blueprint and display the environment variables form:

| Variable | Value / Description |
| :--- | :--- |
| `DATABASE_URL` | Your Supabase pooled connection string (`...sslmode=require`) |
| `FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Your single-line Firebase service account JSON |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client Firebase API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `[PROJECT-ID].firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client Firebase Project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client Firebase App ID |
| `PAYMENTS_ALLOW_MOCK` | `true` (pre-configured) |
| `UPLOADS_ALLOW_LOCAL` | `true` (pre-configured) |
| `CORS_ORIGIN` | `*` (pre-configured) |

6. Click **Apply**.
7. Render will build and deploy the services. Once finished, your live URL will appear on your Render dashboard (e.g. `https://spaceborn-demo.onrender.com`).

---

## 🎯 Testing & Navigating Your Live Deployment

### A. The Unified Demo Hub (`/__portal`)

If deploying via `render.unified.yaml`, open your Render URL:
- Visit `https://your-service.onrender.com/__portal` to open the visual Launchpad.
- A floating pill at the bottom right corner lets you jump between **🛍️ Storefront**, **🏪 Vendor Hub**, and **🛡️ Admin Panel** at any time.
- Direct URL query shortcuts:
  - `https://your-service.onrender.com/?app=store` $\rightarrow$ Customer Storefront
  - `https://your-service.onrender.com/?app=vendor` $\rightarrow$ Vendor Hub
  - `https://your-service.onrender.com/?app=admin` $\rightarrow$ Admin Operations Panel

### B. Testing Full RBAC & CRUD Workflows

1. **Customer Flow (Storefront):**
   - Sign up / sign in with your email.
   - Choose your city location (Kanpur, Bengaluru, or Pune).
   - Browse the 100 electronics and fabrication components.
   - Add items to cart and click **Checkout** (mock payment completes automatically).
   - Track live order status, OTP verification, and simulated delivery.
   - Upload a CAD file (.stl / .step) on `/fabrication` to test 3D printing quotation.

2. **Vendor Flow (Vendor Hub):**
   - Switch to `?app=vendor` and sign in.
   - Submit a store application for premises verification.
   - Once approved, access live store inventory, audio order alerts, and fabrication job quoting.

3. **Admin Flow (Admin Panel):**
   - The root administrator email configured via `ADMIN_EMAILS` (or seeded in the database) has Owner Admin privileges.
   - To grant admin access to any new email, run:
     ```bash
     DATABASE_URL="<YOUR_SUPABASE_URL>" npm run grant-admin -w services/api -- your-email@example.com
     ```
   - Sign in to `?app=admin` with that email.
   - Review pending store applications, verify premises with 1-click Google Maps, approve 3D printing service listings, and inspect the master catalog.

---

## 🛠️ Local Verification & Development

To test the Render build locally before deploying:

```bash
# 1. Typecheck all workspaces:
npm run typecheck

# 2. Build for Render:
npm run render:build:unified

# 3. Start unified gateway locally:
npm run render:start:unified
```

Visit `http://localhost:10000` or `http://localhost:10000/__portal` to test the full stack on your machine.
