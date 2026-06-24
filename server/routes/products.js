import express from 'express';
import { queryBothStores } from '../lib/graphql.js';
import supabase from '../lib/supabase.js';


const router = express.Router();

const PRODUCTS_QUERY = `
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
`;


// Fetch and sync products from both stores
router.get('/sync', async (req, res) => {
  try {
    const { storeA, storeB } = await queryBothStores(PRODUCTS_QUERY);

    const productsToUpsert = [];

    // Process Store A products
storeA.products.edges.forEach(({ node }) => {
  node.variants.edges.forEach(({ node: variant }) => {
    productsToUpsert.push({
      shopify_product_id: node.id,
      title: node.title,
      sku: variant.sku,
      price: parseFloat(variant.price),
      currency: 'INR',
      inventory: variant.inventoryQuantity,
      inventory_item_id: variant.inventoryItem?.id?.split('/').pop(),
      store_origin: 'store_a',
      updated_at: new Date(),
    });
  });
});

// Process Store B products
storeB.products.edges.forEach(({ node }) => {
  node.variants.edges.forEach(({ node: variant }) => {
    productsToUpsert.push({
      shopify_product_id: node.id,
      title: node.title,
      sku: variant.sku,
      price: parseFloat(variant.price),
      currency: 'AED',
      inventory: variant.inventoryQuantity,
      inventory_item_id: variant.inventoryItem?.id?.split('/').pop(),
      store_origin: 'store_b',
      updated_at: new Date(),
    });
  });
});
    // Upsert into Supabase
    const { data, error } = await supabase
      .from('products')
      .upsert(productsToUpsert, { onConflict: 'sku,store_origin' });

    if (error) throw error;

    res.json({ success: true, synced: productsToUpsert.length });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all products from Supabase
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sku');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;