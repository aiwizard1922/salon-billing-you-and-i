import dotenv from 'dotenv';
import { initDb, insertProducts, clearProducts } from './db.js';
import { sampleProducts } from './sampleProducts.js';

dotenv.config();

async function seed() {
  try {
    await initDb();
    await clearProducts();
    await insertProducts(sampleProducts);
    console.log(`✓ Seeded ${sampleProducts.length} products for GemGlow Studio`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
