import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, productCount, insertProducts } from './db.js';
import { sampleProducts } from './sampleProducts.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payment.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('\n❌ DATABASE_URL is not set. Add it to your .env file.');
  console.error('   Local PostgreSQL: postgresql://localhost:5432/gemglow');
  console.error('   Create DB first: createdb gemglow\n');
  process.exit(1);
}

initDb()
  .then(async () => {
    console.log('PostgreSQL connected');
    const count = await productCount();
    if (count === 0) {
      await insertProducts(sampleProducts);
      console.log(`✓ Seeded ${sampleProducts.length} sample products`);
    }
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Database failed:', err.message);
    console.error('   Make sure PostgreSQL is running: brew services start postgresql');
    console.error('   Create database: createdb gemglow');
    process.exit(1);
  });
