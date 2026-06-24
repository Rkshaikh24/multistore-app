import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import { config } from 'dotenv';

config({ path: '.env' });

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.July25,
  isCustomStoreApp: true,
  adminApiAccessToken: process.env.STORE_A_ACCESS_TOKEN,
  isEmbeddedApp: false,
  hostName: 'localhost:3000',
});

// Store A session
export const storeASession = {
  shop: process.env.STORE_A_SHOP,
  accessToken: process.env.STORE_A_ACCESS_TOKEN,
};

// Store B session
export const storeBSession = {
  shop: process.env.STORE_B_SHOP,
  accessToken: process.env.STORE_B_ACCESS_TOKEN,
};