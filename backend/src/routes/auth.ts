import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database';
import { authenticate, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Email, name, and password are required' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];

    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, avatar_color) VALUES (?, ?, ?, ?)'
    ).run(email, password_hash, name, avatar_color);

    const user = db.prepare('SELECT id, email, name, avatar_color, currency, is_premium, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as any;
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      token,
      user: { ...user, is_premium: Boolean(user.is_premium) }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      token,
      user: { ...userWithoutPassword, is_premium: Boolean(user.is_premium) }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  const user = req.user;
  const { password_hash, ...userWithoutPassword } = user;
  res.json({ ...userWithoutPassword, is_premium: Boolean(user.is_premium) });
});

export default router;
