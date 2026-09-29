# Implementation Plan: Secure RBAC & Endpoint Architecture

## Goal Description
During the infrastructure audit, a critical security flaw was identified: the application uses **Firebase Auth** for user identity but queries **Supabase** directly from the client using the Anon Key. Because Supabase doesn't natively recognize Firebase JWTs without custom configuration, Row-Level Security (RLS) on the database has been completely disabled. 

This means currently **anyone** can read, modify, or delete any data (vendors, products, orders, etc.) using the public Anon Key. Furthermore, the `CheckoutView` modifies product stock directly from the client, introducing race conditions.

To build a **proper, sane logic application**, we must:
1. **Lock down the database** by enabling RLS on all tables, denying all direct client access.
2. **Build secure backend endpoints** (Next.js API routes) for data access. These endpoints will verify the Firebase JWT, enforce RBAC (`admin`, `vendor`), and execute database operations securely using the Supabase Service Role Key.
3. **Refactor the React components** to communicate with these endpoints instead of the Supabase client.

## User Review Required
> [!WARNING] 
> This is a structural refactor. We will be moving away from `supabase.from(...)` in the React frontend and replacing them with standard REST API calls (`fetch('/api/...')`). This is the correct, standard way to build a Next.js application that separates a third-party auth provider (Firebase) from a database (Supabase).

## Open Questions
1. Do you want me to write all these endpoints locally in your workspace (`d:\spacebornecomm\Spaceborn-E-commerce`) or do you want me to continue making these changes directly on the AWS EC2 instance via SSH like last time? *(I recommend doing this locally so you can commit the changes to Git, then push/deploy to AWS!)*

---

## Proposed Changes

### 1. Database Infrastructure (Supabase RLS)
We will execute SQL to enable Row-Level Security on all tables. Since we won't add public policies, this explicitly locks down the database. Only the Service Role Key (used in our APIs) will be able to bypass RLS.
#### [EXECUTE SQL] Enable RLS on `vendors`, `products`, `orders`, `carts`, `cart_items`

### 2. Customer Storefront Endpoints & Logic
We will route cart management and checkout through secure APIs.
#### [NEW] `apps/customer-storefront/src/app/api/cart/route.ts`
Handles fetching the active cart, adding items, and removing items. Uses Firebase Admin to verify the user's ID.
#### [NEW] `apps/customer-storefront/src/app/api/checkout/route.ts`
Securely creates the order and decrements product stock on the server, avoiding client-side race conditions.
#### [MODIFY] `apps/customer-storefront/src/context/StoreContext.tsx` & `CheckoutView.tsx`
Replace `supabase.from(...)` calls with `fetch('/api/cart')` and `fetch('/api/checkout')`.

### 3. Vendor Hub Endpoints & Logic
Vendors need secure access to manage their store and products.
#### [NEW] `apps/vendor-hub/src/app/api/vendor/route.ts`
GET/POST endpoints to fetch and upsert the logged-in vendor's profile. Validates the Firebase token.
#### [NEW] `apps/vendor-hub/src/app/api/products/route.ts`
POST endpoint to insert new products. Verifies that the user has the `vendor: true` claim in their Firebase token before allowing the insert.
#### [MODIFY] `apps/vendor-hub/src/views/VendorPortalView.tsx`
Refactor to use the new endpoints for registration and product creation.

### 4. Admin Panel Endpoints & Logic
Admins need to manage vendors and the catalog.
#### [NEW] `apps/admin-panel/src/app/api/vendors/route.ts`
GET endpoint to list all vendors. POST endpoint to reject vendors. Enforces `admin: true` Firebase claim.
#### [NEW] `apps/admin-panel/src/app/api/products/route.ts`
GET endpoint to list all products across all vendors. Enforces `admin: true` claim.
#### [MODIFY] `apps/admin-panel/src/views/AdminProductsView.tsx`
Replace direct Supabase queries with fetches to the new Admin API routes.

## Verification Plan

### Automated Tests
- Validate that Firebase Admin SDK correctly extracts user UID and claims in the API routes.
- Verify that Supabase queries within the API routes succeed using the injected Service Role Key.

### Manual Verification
1. Open the Customer Storefront and place an order. Verify that stock decrements correctly via the backend API.
2. Open the Vendor Hub and attempt to add a product. Verify that it succeeds only if the vendor is approved.
3. Open the Admin Panel and verify that the list of vendors and products loads correctly from the new API routes.
4. Try to query Supabase directly from the browser console using the Anon Key to confirm that RLS successfully blocks unauthorized access.
