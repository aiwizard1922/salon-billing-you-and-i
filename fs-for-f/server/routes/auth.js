import express from 'express';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, comparePassword } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const existing = await findUserByEmail(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const user = await createUser(name, email, password);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'fallback-secret');
    res.status(201).json({ user: { id: user._id, _id: user._id, name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await comparePassword(user, password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'fallback-secret');
    res.json({ user: { id: String(user.id), _id: String(user.id), name: user.name, email: user.email, role: user.role }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
