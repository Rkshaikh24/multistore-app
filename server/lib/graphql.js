import { config } from 'dotenv';
config({ path: '.env' });

const STORE_A = {
  shop: process.env.STORE_A_SHOP,
  token: process.env.STORE_A_ACCESS_TOKEN,
};

const STORE_B = {
  shop: process.env.STORE_B_SHOP,
  token: process.env.STORE_B_ACCESS_TOKEN,
};

// Direct GraphQL fetch — works with custom app tokens
export async function queryShopify(store, query, variables = {}) {
  const url = `https://${store.shop}/admin/api/2025-07/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': store.token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error ${response.status}: ${text}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// Query both stores simultaneously
export async function queryBothStores(query, variables = {}) {
  const [storeA, storeB] = await Promise.all([
    queryShopify(STORE_A, query, variables),
    queryShopify(STORE_B, query, variables),
  ]);

  return { storeA, storeB };
}