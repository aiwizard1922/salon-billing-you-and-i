import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createOrder, updateOrder, findOrderById, getCartItemsForOrder, clearCart } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post('/create-order', authenticate, async (req, res) => {
  try {
    const items = await getCartItemsForOrder(req.user.id);
    if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

    const totalAmountRs = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const totalAmountPaise = Math.round(totalAmountRs * 100);

    const order = await createOrder(req.user.id, items, totalAmountRs);

    const options = {
      amount: totalAmountPaise,
      currency: 'INR',
      receipt: String(order.id),
      notes: { orderId: String(order.id) }
    };

    const razorpayOrder = await razorpay.orders.create(options);
    res.json({
      razorpayOrderId: razorpayOrder.id,
      orderId: String(order.id),
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify', authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const order = await findOrderById(order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    await updateOrder(order_id, {
      paymentId: razorpay_payment_id,
      paymentStatus: 'paid',
      status: 'confirmed'
    });

    await clearCart(req.user.id);

    res.json({ success: true, order: { ...order, paymentStatus: 'paid', status: 'confirmed' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
