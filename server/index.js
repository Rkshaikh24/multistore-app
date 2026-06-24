import { config } from 'dotenv';
config({ path: '.env' });

import express from 'express';
import cors from 'cors';
import productsRouter from './routes/products.js';
import webhooksRouter from './routes/webhooks.js';

const app = express();

app.use(cors());

// Parse JSON body for all routes
app.use(express.json());

// Routes
app.use('/api/products', productsRouter);
app.use('/api/orders', webhooksRouter);
app.use('/webhooks', webhooksRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});