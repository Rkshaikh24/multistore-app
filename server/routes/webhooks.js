import express from 'express';
import supabase from '../lib/supabase.js';

const router = express.Router();

// Determine which store sent the webhook
function getStoreOrigin(req) {
  const shopDomain = req.headers['x-shopify-shop-domain'];
  if (shopDomain === process.env.STORE_A_SHOP) return 'store_a';
  if (shopDomain === process.env.STORE_B_SHOP) return 'store_b';
  return 'unknown';
}

// Orders create webhook
router.post('/orders/create', async (req, res) => {
  const store_origin = getStoreOrigin(req);
  const order = req.body;

  try {
    await supabase.from('webhook_logs').insert({
      store_origin,
      topic: 'orders/create',
      payload: order,
      status: 'processing',
    });

    await supabase.from('orders').upsert({
      shopify_order_id: String(order.id),
      store_origin,
      total_price: parseFloat(order.total_price),
      currency: order.currency,
      line_items: order.line_items,
      status: order.financial_status,
    }, { onConflict: 'shopify_order_id,store_origin' });

    await supabase
      .from('webhook_logs')
      .update({ status: 'processed', processed_at: new Date() })
      .eq('store_origin', store_origin)
      .eq('topic', 'orders/create')
      .eq('status', 'processing');

    res.status(200).send('OK');
  } catch (error) {
    console.error('Order webhook error:', error);
    res.status(500).send('Error');
  }
});

// Inventory update webhook
router.post('/inventory/update', async (req, res) => {
  const store_origin = getStoreOrigin(req);
  const inventory = req.body;

  try {
    const available = inventory.available;
    const inventoryItemId = String(inventory.inventory_item_id);

    console.log(`📦 Inventory update: item ${inventoryItemId} → ${available} units (${store_origin})`);

    if (inventoryItemId && available !== undefined) {
      const { error } = await supabase
        .from('products')
        .update({ inventory: available, updated_at: new Date() })
        .eq('inventory_item_id', inventoryItemId)
        .eq('store_origin', store_origin);

      if (error) throw error;
      console.log(`✅ Inventory updated in DB`);
    }

    await supabase.from('webhook_logs').insert({
      store_origin,
      topic: 'inventory/update',
      payload: inventory,
      status: 'processed',
      processed_at: new Date(),
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Inventory webhook error:', error);
    res.status(500).send('Error');
  }
});

// Orders get route
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;