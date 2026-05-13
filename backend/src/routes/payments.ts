import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, (req: AuthRequest, res: Response): void => {
  const { group_id, from_user_id, to_user_id, amount, currency, notes } = req.body;

  if (!from_user_id || !to_user_id || !amount) {
    res.status(400).json({ error: 'from_user_id, to_user_id, and amount are required' });
    return;
  }

  try {
    if (group_id) {
      const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(group_id, req.userId);
      if (!member) {
        res.status(403).json({ error: 'Not a member of this group' });
        return;
      }
    }

    const result = db.prepare(`
      INSERT INTO payments (group_id, from_user_id, to_user_id, amount, currency, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      group_id || null,
      parseInt(from_user_id),
      parseInt(to_user_id),
      parseFloat(amount),
      currency || 'EUR',
      notes || null
    );

    if (group_id) {
      const fromUser = db.prepare('SELECT name FROM users WHERE id = ?').get(from_user_id) as any;
      const toUser = db.prepare('SELECT name FROM users WHERE id = ?').get(to_user_id) as any;
      db.prepare('INSERT INTO activities (group_id, user_id, type, data) VALUES (?, ?, ?, ?)').run(
        group_id, req.userId, 'payment_made', JSON.stringify({
          from: fromUser?.name, to: toUser?.name, amount: parseFloat(amount), currency: currency || 'EUR'
        })
      );
    }

    const payment = db.prepare(`
      SELECT p.*, fu.name as from_user_name, tu.name as to_user_name
      FROM payments p
      JOIN users fu ON p.from_user_id = fu.id
      JOIN users tu ON p.to_user_id = tu.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(payment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/group/:groupId', authenticate, (req: AuthRequest, res: Response): void => {
  const groupId = parseInt(req.params.groupId);

  try {
    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.userId);
    if (!member) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const payments = db.prepare(`
      SELECT p.*, fu.name as from_user_name, tu.name as to_user_name
      FROM payments p
      JOIN users fu ON p.from_user_id = fu.id
      JOIN users tu ON p.to_user_id = tu.id
      WHERE p.group_id = ?
      ORDER BY p.created_at DESC
    `).all(groupId);

    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
