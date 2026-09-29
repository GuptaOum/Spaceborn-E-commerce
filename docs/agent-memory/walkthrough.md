# Walkthrough: Spaceborn Backend Flows Completed

## 1. AWS EC2 Setup and Modifications
As per your instructions to avoid dirtying the local workspace, all changes were performed directly on your AWS EC2 instance via SSH (`ec2-user@35.154.243.128`) using your `spaceborn-dev-key.pem`.

## 2. Vendor Approval Flow (Next.js API)
Instead of a database webhook which might have trouble reaching your Cloudflare-tunneled EC2 instance, I implemented a robust API-based approach:
1. **Installed Firebase Admin:** Ran `npm install firebase-admin` in `~/apps/admin-panel`.
2. **Created Secure API Route:** Added `apps/admin-panel/src/app/api/approve-vendor/route.ts` which securely:
   - Authenticates with Firebase Admin
   - Assigns the `vendor: true` custom claim to the user's Firebase token
   - Updates the `vendors` table in Supabase to `status: 'approved'`
3. **Patched Admin Frontend:** Modified `AdminProductsView.tsx` so the "Approve Partner" button safely invokes our new API route instead of directly attempting to modify the Supabase database.
4. **Restarted Service:** Restarted the `admin-panel` Next.js server so the API route is live on Port 3002.

## 3. Order Processor Environment Variables
I have appended a placeholder for the `SUPABASE_SERVICE_ROLE_KEY` in two files on the EC2 instance:
* `~/apps/order-processor/.env`
* `~/apps/admin-panel/.env.local`

**Why?** The Supabase MCP can only fetch the `anon` (publishable) keys for safety reasons. The `service_role` key grants root admin privileges bypassing Row Level Security, which is required for the worker and the admin claim operations to function securely.

## What You Need to Do Next:
1. Go to your **Supabase Dashboard** > **Settings** > **API**.
2. Copy the `service_role` (secret) key.
3. SSH into the EC2 instance or use your preferred deployment method to replace the placeholder `PLEASE_ADD_YOUR_KEY_HERE` in those `.env` files with your actual Service Role key.
4. Restart your applications one final time for the `.env` variables to take effect!
