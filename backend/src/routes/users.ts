import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/search', authenticate, (req: AuthRequest, res: Response): void => {
  const q = req.query.q as string;
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters' });
    return;
  }

  try {
    const users = db.prepare(
      'SELECT id, email, name, avatar_color, currency, is_premium, created_at FROM users WHERE email LIKE ? AND id != ? LIMIT 10'
    ).all(`%${q}%`, req.userId) as any[];

    res.json(users.map(u => ({ ...u, is_premium: Boolean(u.is_premium) })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', authenticate, (req: AuthRequest, res: Response): void => {
  const { name, currency, avatar_color } = req.body;

  try {
    if (name) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId);
    }
    if (currency) {
      db.prepare('UPDATE users SET currency = ? WHERE id = ?').run(currency, req.userId);
    }
    if (avatar_color) {
      db.prepare('UPDATE users SET avatar_color = ? WHERE id = ?').run(avatar_color, req.userId);
    }

    const user = db.prepare('SELECT id, email, name, avatar_color, currency, is_premium, created_at FROM users WHERE id = ?').get(req.userId) as any;
    res.json({ ...user, is_premium: Boolean(user.is_premium) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upgrade-premium', authenticate, (req: AuthRequest, res: Response): void => {
  try {
    db.prepare('UPDATE users SET is_premium = 1 WHERE id = ?').run(req.userId);
    const user = db.prepare('SELECT id, email, name, avatar_color, currency, is_premium, created_at FROM users WHERE id = ?').get(req.userId) as any;
    res.json({ ...user, is_premium: Boolean(user.is_premium) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/account', authenticate, (req: AuthRequest, res: Response): void => {
  try {
    // Remove from all groups
    db.prepare('DELETE FROM group_members WHERE user_id = ?').run(req.userId);
    // Delete the user
    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
    res.json({ message: 'Account deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
