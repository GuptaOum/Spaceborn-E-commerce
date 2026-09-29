# Implementation Plan: Spaceborn Vendor Approval & Worker Configuration

## Goal Description
We need to complete the remaining critical backend flows for the Spaceborn e-commerce project directly on the AWS EC2 environment:
1. **First Flow (Worker Environment Variables):** Inject the Supabase Service Role Key into the Node.js/Celery worker process (`apps/order-processor`) on the EC2 instance so it can safely bypass RLS to process inventory.
2. **Second Flow (Vendor Approval Flow):** Instead of using a complex database trigger that cannot reach your hidden EC2 admin panel, we will create a secure Next.js API route (`/api/approve-vendor`) in the `admin-panel` application on AWS. This route will initialize the Firebase Admin SDK to set the `vendor` custom claim and update the Supabase vendor status synchronously.

> [!NOTE]
> All code modifications will be performed directly on your AWS EC2 instance (`ec2-user@35.154.243.128`) using SSH, leaving your local workspace completely pristine as requested.

## User Review Required
> [!IMPORTANT]
> The Supabase MCP `get_publishable_keys` tool only exposes the `anon` key for client-side use. It does not provide the `service_role` key (which acts as a root admin key). **I will need you to provide the `SUPABASE_SERVICE_ROLE_KEY` directly so I can inject it into the `.env` file on the EC2 instance, OR you can manually paste it into `~/apps/order-processor/.env` on the EC2 instance later.**

## Open Questions
1. Do you have the `SUPABASE_SERVICE_ROLE_KEY` handy to paste in our chat? If yes, I can handle the `.env` injection automatically for you during execution.
2. Since I will be adding `firebase-admin` to the `admin-panel` on the EC2 instance, do you want me to also configure the service account JSON, or does `setAdminClaim.js` already have the necessary permissions via Application Default Credentials / environment variables on the EC2 instance?

---

## Proposed Changes (Executed via SSH to EC2)

### 1. Order Processor Worker (.env configuration)
We will append the necessary environment variables to the worker process on AWS.
#### [MODIFY] `~/apps/order-processor/.env` (on EC2)
```env
# (Existing variables...)
SUPABASE_SERVICE_ROLE_KEY="<YOUR_PROVIDED_KEY_OR_PLACEHOLDER>"
```

### 2. Admin Panel Dependencies
We need to install the Firebase Admin SDK on the EC2 instance.
#### [EXECUTE] `npm install firebase-admin` in `~/apps/admin-panel` (on EC2)

### 3. Admin Panel Next.js API Route
We will create a new secure API route to handle the vendor approval process securely from the backend.
#### [NEW] `~/apps/admin-panel/src/app/api/approve-vendor/route.ts` (on EC2)
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Only once)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { vendorId, email } = await req.json();

    // 1. Set Firebase Custom Claim
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { ...user.customClaims, admin: false, vendor: true });

    // 2. Update Supabase Database Status
    const { error } = await supabase.from('vendors').update({ status: 'approved' }).eq('id', vendorId);
    
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 4. Admin Panel Frontend Update
Modify the frontend button click handler to invoke our new secure API route instead of directly modifying Supabase from the client.
#### [MODIFY] `~/apps/admin-panel/src/views/AdminProductsView.tsx` (on EC2)
```tsx
// Inside handleApproveVendor
const handleApproveVendor = async (vendorId: string, email: string) => {
    // Calling our new Next.js API route
    const res = await fetch('/api/approve-vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, email })
    });
    
    if (res.ok) {
        setDbVendors(prev => prev.map(v => v.id === vendorId ? { ...v, status: 'approved' } : v));
        alert("Vendor approved! Their Seller Central is now unlocked.");
    } else {
        alert("Error approving vendor.");
    }
};
```

## Verification Plan

### Automated Tests
1. Verify the `order-processor` worker picks up the new `.env` variables and connects to Supabase successfully via PM2 or Nohup logs.
2. Ensure the `admin-panel` application successfully restarts without build errors.

### Manual Verification
1. Click the "Approve Partner" button in the Admin Panel for a pending vendor.
2. Observe if the API call succeeds (Status 200).
3. Check Supabase to ensure the vendor's status is `approved`.
4. Check Firebase Authentication to ensure the user has the `vendor: true` custom claim.
