# Spaceborn — New Machine Onboarding & Setup Guide

> **Important**: This guide is designed for setting up Spaceborn on a brand-new computer from scratch. Follow these steps sequentially to get your local environment running and connect to AWS cloud infrastructure.

---

## 1. Prerequisites to Install on Your New Machine

Install the following tools before cloning the project:

### 1.1 Node.js (v20+ LTS)
- Download and install **Node.js 20.x or 22.x LTS** from [nodejs.org](https://nodejs.org/).
- Verify in terminal:
  ```bash
  node -v   # Should output >= v20.0.0
  npm -v    # Should output >= 10.0.0
  ```

### 1.2 Git
- Download and install **Git** from [git-scm.com](https://git-scm.com/).
- Set your identity:
  ```bash
  git config --global user.name "GuptaOum"
  git config --global user.email "oumgupta555@gmail.com"
  ```

### 1.3 AWS CLI v2
- Download the official installer from [aws.amazon.com/cli](https://aws.amazon.com/cli/).
- In terminal, verify installation:
  ```bash
  aws --version
  ```
- Configure your AWS credentials:
  ```bash
  aws configure
  ```
  Fill in your AWS details:
  - **AWS Access Key ID**: *(Your AWS access key)*
  - **AWS Secret Access Key**: *(Your AWS secret key)*
  - **Default region name**: `ap-south-1`
  - **Default output format**: `json`

### 1.4 AWS Session Manager Plugin (MANDATORY for Admin Tunnel)
- The Admin Panel is air-gapped and requires port forwarding through an AWS SSM Bastion host.
- **Windows Installer**: Download and install the MSI from:  
  `https://s3.amazonaws.com/session-manager-downloads/plugin/latest/windows/SessionManagerPluginSetup.exe`
- Default install path: `C:\Program Files\Amazon\SessionManagerPlugin\bin`
- Verify in terminal:
  ```bash
  session-manager-plugin
  # Expected output: The Session Manager plugin is installed successfully.
  ```

### 1.5 Terraform (v1.8+)
- Download Terraform from [developer.hashicorp.com/terraform/downloads](https://developer.hashicorp.com/terraform/downloads).
- Unzip and add the directory containing `terraform.exe` to your system `PATH`.
- Verify in terminal:
  ```bash
  terraform -version
  ```

---

## 2. Cloning & Workspace Setup

### 2.1 Clone the Repository
```bash
git clone https://github.com/GuptaOum/Spaceborn-E-commerce.git
cd Spaceborn-E-commerce
```

### 2.2 Install Dependencies
Spaceborn uses **npm workspaces** to manage all packages from the root:
```bash
npm install
```
This automatically links and installs dependencies for:
- `@spaceborn/web-core` (Shared React core & Firebase Auth)
- `@spaceborn/api` (Backend Express server)
- `customer-storefront` (Customer Next.js app)
- `vendor-hub` (Vendor Next.js app)
- `admin-panel` (Admin Next.js app)

### 2.3 Verify Code Integrity
Run the workspace automated typecheck:
```bash
npm run typecheck
```
All 4 workspaces should pass with 0 errors.

---

## 3. Running Locally (Offline Development)

To run the entire platform locally on your computer:

```bash
npm run dev
```

This launches all applications concurrently:
| Application | Local URL | Description |
| :--- | :--- | :--- |
| **Customer Storefront** | `http://localhost:3000` | Browse catalog, add to cart, order, upload 3D CAD files |
| **Vendor Hub** | `http://localhost:3001` | Seller inventory management & 3D print quote dashboard |
| **Admin Panel** | `http://localhost:3002` | Vendor store approvals, service approvals, master catalog |
| **Express API** | `http://localhost:4000` | Backend API and database query engine (`/v1/*`) |

*Note: In local development mode, Next.js rewrites all `/v1/*` requests to `http://localhost:4000`.*

---

## 4. Deploying & Managing AWS Cloud Infrastructure

The entire AWS production infrastructure is codified with **Terraform** in the `terraform/` directory.

### 4.1 Check Pre-Configured Terraform Variables
Check `terraform/terraform.tfvars`:
```hcl
aws_account_id      = "758530010955"
aws_profile         = "default"
firebase_project_id = "spaceborn-ecommerce-app"
domain_name         = "spaceborn.local"
environment         = "dev"
mail_from           = ""
```

### 4.2 Spinning Up the Cloud Infrastructure
If the infrastructure is currently destroyed and you want to deploy it again:

1. **Option A — Via Terraform Directly**:
   ```bash
   cd terraform
   terraform init
   terraform apply -auto-approve
   ```
2. **Option B — Full Cloud Build & Rolling Deploy**:
   From repository root in PowerShell:
   ```powershell
   .\ops\spaceborn.ps1 deploy
   ```
   *This packages the repo, triggers AWS CodeBuild in the cloud to compile the 4 Docker container images, updates ECS task definitions, runs DB migrations, and rolls all ECS services without consuming local CPU.*

---

## 5. Connecting as Admin on Your New Machine

Because the Admin Panel is private and not exposed to the public internet, you access it via an encrypted SSM tunnel:

### Step 1: Launch the Tunnel
Open PowerShell in the repo root:
```powershell
.\ops\spaceborn.ps1 tunnel -Target admin
```
- The script automatically checks if the EC2 Bastion host is running.
- If stopped, it automatically starts it, waits for the SSM agent to connect, and binds `http://localhost:8080` to the private Internal Admin Load Balancer.

### Step 2: Open Your Browser
Navigate to:
```
http://localhost:8080
```

### Step 3: Sign In with Google
- Click **Sign in with Google**.
- Select **`oumgupta555@gmail.com`**.
- You will be admitted directly to the Admin Dashboard.

---

## 6. Testing All 3 Roles with One Gmail Account

| Role | Portal / URL | Recommended Email | How It Works |
| :--- | :--- | :--- | :--- |
| **Customer** | Storefront (`:3000` or CloudFront) | `oumgupta555@gmail.com` | Standard customer account for shopping and ordering. |
| **Vendor** | Vendor Hub (`:3001` or Port 8080) | `oumgupta555+vendor@gmail.com` | Using a `+` alias ensures fraud-prevention rules don't conflict with your Admin identity. Emails still arrive in your primary inbox! |
| **Admin** | Admin Panel (`:3002` or `localhost:8080` via tunnel) | `oumgupta555@gmail.com` | Hardcoded in `DEFAULT_ADMIN_EMAILS` across backend and frontend. Instant administrative authorization. |

---

## 7. Pausing or Tearing Down Infrastructure

### 7.1 Pause (Save Money Without Destroying)
To stop paying for compute while keeping your database and configs intact:
```powershell
.\ops\spaceborn.ps1 stop
```
*(Scales ECS tasks to 0, stops RDS instance, stops Bastion host).*

### 7.2 Resume (Unpark)
```powershell
.\ops\spaceborn.ps1 start
```

### 7.3 Total Teardown (Delete Everything Down to $0)
If you want to wipe all 98 AWS resources completely:
- On **Windows (PowerShell)**:
  ```powershell
  .\down.ps1
  ```
- On **Linux / macOS (Bash)**:
  ```bash
  ./down.sh
  ```
This executes `terraform destroy -auto-approve` and deletes the VPC, ALBs, CloudFront, ECS, RDS, S3 bucket, and all associated security groups.
