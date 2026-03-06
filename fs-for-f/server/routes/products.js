import express from 'express';
import { findProducts, findProductById, createProduct, updateProduct, deactivateProduct } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const products = await findProducts(true);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin', authenticate, isAdmin, async (req, res) => {
  try {
    const products = await findProducts(false);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await deactivateProduct(req.params.id);
    res.json({ message: 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
