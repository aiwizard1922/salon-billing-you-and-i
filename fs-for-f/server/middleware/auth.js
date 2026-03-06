import jwt from 'jsonwebtoken';
import { findUserById } from '../db.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await findUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = { ...user, id: user.id || user._id };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
