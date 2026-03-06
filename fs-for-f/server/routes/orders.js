import express from 'express';
import { createOrder, findOrders, findOrderById, updateOrderStatus, getCartItemsForOrder, clearCart } from '../db.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const orders = await findOrders(req.user.id, req.user.role === 'admin');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await findOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const items = await getCartItemsForOrder(req.user.id);
    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = await createOrder(req.user.id, items, totalAmount);
    await clearCart(req.user.id);

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', authenticate, isAdmin, async (req, res) => {
  try {
    const order = await updateOrderStatus(req.params.id, req.body.status);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
