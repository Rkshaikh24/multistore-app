# Multistore Shopify Sync — Architecture & Documentation

## Live Links

| Service | URL |
|---|---|
| Dashboard (Frontend) | https://multistore-dashboard.vercel.app/ |
| Backend API (Render) | https://multistore-app-447u.onrender.com |
| GitHub — App | https://github.com/Rkshaikh24/multistore-app |
| GitHub — Dashboard | https://github.com/Rkshaikh24/multistore-dashboard |
| Store A (INR) | https://indi-uf3etlsc.myshopify.com |
| Store B (AED) | https://unit-lmxnsjsu.myshopify.com |

---

## System Architecture Overview

```
┌─────────────────────┐        ┌─────────────────────┐
│   Store A (INR)     │        │   Store B (AED)      │
│  indi-uf3etlsc      │        │  unit-lmxnsjsu       │
│                     │        │                      │
│  - 5 Products       │        │  - 5 Products        │
│  - Matching SKUs    │        │  - Matching SKUs     │
│  - INR Pricing      │        │  - AED Pricing       │
│  - Metaobjects      │        │  - Metaobjects       │
└────────┬────────────┘        └──────────┬───────────┘
         │  Webhooks                       │  Webhooks
         │  (orders/create,               │  (orders/create,
         │   inventory/update,            │   inventory/update,
         │   products/update)             │   products/update)
         └──────────────┬─────────────────┘
                        ▼
         ┌──────────────────────────────┐
         │     Express.js Middleware    │
         │         (Render)             │
         │                              │
         │  - Webhook receiver          │
         │  - GraphQL sync engine       │
         │  - Rate limit queue          │
         │  - Deduplication logic       │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │       Supabase               │
         │    (PostgreSQL)              │
         │                              │
         │  - products table            │
         │  - orders table              │
         │  - webhook_logs table        │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │    React Dashboard           │
         │       (Vercel)               │
         │                              │
         │  - Product Catalog Matrix    │
         │  - Cross-Store Order Feed    │
         │  - Live Inventory Updates    │
         └──────────────────────────────┘
```

---

## Module 1: Store Setup & Environment Architecture

### Two Shopify Development Stores

| Store | Domain | Currency | Market |
|---|---|---|---|
| Store A | indi-uf3etlsc.myshopify.com | INR (₹) | Domestic |
| Store B | unit-lmxnsjsu.myshopify.com | AED (د.إ) | International |

### Shared Product Catalog (Identical SKUs)

| SKU | Product Name | Store A Price (INR) | Store B Price (AED) |
|---|---|---|---|
| SKU001 | The Collection Snowboard: Liquid | ₹749.95 | AED 30 |
| SKU002 | The 3p Fulfilled Snowboard | ₹2629.95 | AED 40 |
| SKU003 | The Multi-managed Snowboard | ₹629.95 | AED 30 |
| SKU004 | The Collection Snowboard: Oxygen | ₹1025 | AED 50 |
| SKU005 | The Multi-location Snowboard | ₹729.95 | AED 20 |

### Metaobject Schema

A `extended_product_specifications` Metaobject definition was created on both stores via the Admin GraphQL API with the following fields:

- `washing_instructions` (single_line_text_field)
- `dimensions` (single_line_text_field)
- `material_blend` (single_line_text_field)

---

## Module 2: Custom Shopify App & Webhook Engine

### Authentication & Data Fetching

All data fetching uses the **Shopify Admin GraphQL API exclusively** — no REST endpoints are used. Each store has a dedicated Custom App installed with the following OAuth scopes:

- `read_products` / `write_products`
- `read_inventory` / `write_inventory`
- `read_orders` / `write_orders`
- `read_locations`

### GraphQL Query Example

```graphql
query {
  products(first: 10) {
    edges {
      node {
        id
        title
        variants(first: 5) {
          edges {
            node {
              sku
              price
              inventoryQuantity
              inventoryItem {
                id
              }
            }
          }
        }
      }
    }
  }
}
```

### Rate Limiting — Leaky Bucket Implementation

To handle high-volume flash sale scenarios, all GraphQL requests are routed through a `p-queue` based rate limiter:

```javascript
import PQueue from 'p-queue';

// Max 10 requests per second — respects Shopify's leaky bucket
const queue = new PQueue({ intervalCap: 10, interval: 1000 });

export async function queryShopify(store, query, variables = {}) {
  return queue.add(async () => {
    // GraphQL fetch here
  });
}
```

This ensures that during flash sales with concurrent inventory updates, requests are throttled to stay within Shopify's GraphQL cost limits (2000 points/second restore rate).

### Registered Webhooks

| Topic | Endpoint | Both Stores |
|---|---|---|
| `orders/create` | `/webhooks/orders/create` | ✅ |
| `inventory_levels/update` | `/webhooks/inventory/update` | ✅ |
| `products/update` | `/webhooks/products/update` | ✅ |

---

## Module 3: Middleware Dashboard & Cloud Deployment

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js |
| Frontend | React + Tailwind CSS + Vite |
| Database | Supabase (PostgreSQL) |
| Backend Hosting | Render (free tier) |
| Frontend Hosting | Vercel (free tier) |
| Queue | p-queue (leaky bucket) |

### Database Schema

```sql
-- Products: deduplication via composite unique key
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  shopify_product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sku TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  inventory INTEGER DEFAULT 0,
  inventory_item_id TEXT,
  store_origin TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(sku, store_origin)       -- ← deduplication key
);

-- Orders: deduplication via composite unique key
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  shopify_order_id TEXT NOT NULL,
  store_origin TEXT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  line_items JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shopify_order_id, store_origin)  -- ← deduplication key
);

-- Webhook logs: for failure tracking and retry
CREATE TABLE webhook_logs (
  id SERIAL PRIMARY KEY,
  store_origin TEXT NOT NULL,
  topic TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);
```

---

## Webhook Failure Handling & Retry Strategy

### How Webhook Failures Are Handled

Every incoming webhook is immediately logged to the `webhook_logs` table with `status: 'processing'` before any business logic runs. This ensures no event is silently lost.

```javascript
// Step 1: Log immediately on receipt
await supabase.from('webhook_logs').insert({
  store_origin,
  topic: 'orders/create',
  payload: order,
  status: 'processing',
});

// Step 2: Process business logic
await supabase.from('orders').upsert({ ... });

// Step 3: Mark as processed
await supabase.from('webhook_logs')
  .update({ status: 'processed', processed_at: new Date() })
  .eq('status', 'processing');
```

If Step 2 fails, the log entry remains as `status: 'processing'` or is updated to `status: 'failed'`. A background retry job can query for all failed/pending entries and reprocess them:

```javascript
// Retry query
const { data: failed } = await supabase
  .from('webhook_logs')
  .select('*')
  .eq('status', 'failed')
  .lt('retry_count', 3);  // max 3 retries
```

### Shopify's Built-in Retry Behaviour

Shopify automatically retries failed webhook deliveries (non-2xx responses) up to 19 times over 48 hours with exponential backoff. Our system returns `500` on failure, which triggers Shopify's retry mechanism as a secondary safety net.

---

## Data Deduplication Logic

### Problem

Both Store A and Store B carry the same 5 SKUs. A naive implementation would either overwrite Store A's data with Store B's or treat them as duplicate records.

### Solution — Composite Unique Key

The `products` table uses a **composite unique key** on `(sku, store_origin)`:

```sql
UNIQUE(sku, store_origin)
```

This means `SKU001` from `store_a` and `SKU001` from `store_b` are stored as **two distinct rows** representing two distinct retail endpoints of the same physical product:

```
| sku    | store_origin | price   | currency | inventory |
|--------|--------------|---------|----------|-----------|
| SKU001 | store_a      | 749.95  | INR      | 44        |
| SKU001 | store_b      | 30.00   | AED      | 50        |
```

### Upsert Strategy for Concurrent Updates

During flash sales with rapid concurrent inventory updates, all writes use `upsert` with `onConflict`:

```javascript
await supabase
  .from('products')
  .upsert(productsToUpsert, { onConflict: 'sku,store_origin' });
```

This means even if the same webhook fires multiple times (e.g., Shopify retries), the latest inventory value simply overwrites the previous one without creating duplicates. PostgreSQL's atomic upsert guarantees no race conditions at the database level.

### Order Deduplication

Orders use `UNIQUE(shopify_order_id, store_origin)` — so even if the `orders/create` webhook fires twice for the same order (Shopify occasionally sends duplicate webhooks), the second upsert is a no-op.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/products` | Get all products from DB |
| GET | `/api/products/sync` | Sync products from both stores |
| GET | `/api/orders` | Get all orders from DB |
| POST | `/webhooks/orders/create` | Receive order webhooks |
| POST | `/webhooks/inventory/update` | Receive inventory webhooks |
| POST | `/webhooks/products/update` | Receive product update webhooks |

---

## Environment Variables

```env
STORE_A_SHOP=indi-uf3etlsc.myshopify.com
STORE_A_ACCESS_TOKEN=***
STORE_B_SHOP=unit-lmxnsjsu.myshopify.com
STORE_B_ACCESS_TOKEN=***
SHOPIFY_API_KEY=***
SHOPIFY_API_SECRET=***
SUPABASE_URL=***
SUPABASE_ANON_KEY=***
PORT=3000
APP_URL=https://your-render-url.onrender.com
```

---

## Local Development Setup

```bash
# Clone the repo
git clone https://github.com/Rkshaikh24/multistore-app.git
cd multistore-app

# Install dependencies
npm install

# Create .env file and fill in credentials
cp .env.example .env

# Start the server
node server/index.js

# In a separate terminal — start the dashboard
cd dashboard
npm install
npm run dev
```
