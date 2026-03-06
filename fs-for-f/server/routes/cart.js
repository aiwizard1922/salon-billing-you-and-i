import express from 'express';
import { getCartWithItems, addToCart, updateCartItem, removeFromCart, clearCart } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const cart = await getCartWithItems(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const cart = await addToCart(req.user.id, productId, quantity);
    if (!cart) return res.status(404).json({ error: 'Product not found' });
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/update/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await updateCartItem(req.user.id, req.params.productId, quantity);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/remove/:productId', async (req, res) => {
  try {
    const cart = await removeFromCart(req.user.id, req.params.productId);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear', async (req, res) => {
  try {
    await clearCart(req.user.id);
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
