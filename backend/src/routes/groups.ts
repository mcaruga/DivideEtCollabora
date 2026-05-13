import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function getGroupBalances(groupId: number): { from_user_id: number; to_user_id: number; amount: number }[] {
  // Get all expenses and splits for the group
  const expenses = db.prepare('SELECT * FROM expenses WHERE group_id = ?').all(groupId) as any[];
  const payments = db.prepare('SELECT * FROM payments WHERE group_id = ?').all(groupId) as any[];

  // net[userId] = positive means they are owed, negative means they owe
  const net: Record<number, number> = {};

  for (const expense of expenses) {
    const splits = db.prepare('SELECT * FROM expense_splits WHERE expense_id = ?').all(expense.id) as any[];
    // The payer is owed by each split member their split amount (excluding themselves)
    for (const split of splits) {
      if (split.user_id !== expense.paid_by) {
        // split.user_id owes expense.paid_by split.amount
        net[expense.paid_by] = (net[expense.paid_by] || 0) + split.amount;
        net[split.user_id] = (net[split.user_id] || 0) - split.amount;
      }
    }
  }

  // Apply payments
  for (const payment of payments) {
    // from_user paid to_user, so from_user's debt decreases, to_user's credit decreases
    net[payment.from_user_id] = (net[payment.from_user_id] || 0) + payment.amount;
    net[payment.to_user_id] = (net[payment.to_user_id] || 0) - payment.amount;
  }

  // Simplify debts using greedy algorithm
  const creditors: { id: number; amount: number }[] = [];
  const debtors: { id: number; amount: number }[] = [];

  for (const [userIdStr, balance] of Object.entries(net)) {
    const userId = parseInt(userIdStr);
    if (balance > 0.001) creditors.push({ id: userId, amount: balance });
    else if (balance < -0.001) debtors.push({ id: userId, amount: -balance });
  }

  const transactions: { from_user_id: number; to_user_id: number; amount: number }[] = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.001) {
      transactions.push({
        from_user_id: debtor.id,
        to_user_id: creditor.id,
        amount: Math.round(amount * 100) / 100
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.001) i++;
    if (creditor.amount < 0.001) j++;
  }

  return transactions;
}

router.get('/', authenticate, (req: AuthRequest, res: Response): void => {
  try {
    const groups = db.prepare(`
      SELECT g.*, COUNT(gm2.user_id) as member_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
      LEFT JOIN group_members gm2 ON g.id = gm2.group_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `).all(req.userId) as any[];

    const result = groups.map(group => {
      const balances = getGroupBalances(group.id);
      let myBalance = 0;
      for (const b of balances) {
        if (b.to_user_id === req.userId) myBalance += b.amount;
        if (b.from_user_id === req.userId) myBalance -= b.amount;
      }
      return { ...group, my_balance: Math.round(myBalance * 100) / 100 };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, (req: AuthRequest, res: Response): void => {
  const { name, description, type, cover_color } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }

  try {
    const result = db.prepare(
      'INSERT INTO groups (name, description, type, cover_color, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(name, description || null, type || 'other', cover_color || '#10B981', req.userId);

    // Add creator as member
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(result.lastInsertRowid, req.userId);

    // Log activity
    db.prepare('INSERT INTO activities (group_id, user_id, type, data) VALUES (?, ?, ?, ?)').run(
      result.lastInsertRowid, req.userId, 'group_created', JSON.stringify({ name })
    );

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(group);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, (req: AuthRequest, res: Response): void => {
  const groupId = parseInt(req.params.id);

  try {
    // Check membership
    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.userId);
    if (!member) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any;
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const members = db.prepare(`
      SELECT u.id, u.email, u.name, u.avatar_color, u.currency, u.is_premium, u.created_at
      FROM users u
      JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = ?
    `).all(groupId) as any[];

    const rawBalances = getGroupBalances(groupId);

    // Attach user names to balances
    const balances = rawBalances.map(b => {
      const fromUser = members.find(m => m.id === b.from_user_id);
      const toUser = members.find(m => m.id === b.to_user_id);
      return {
        ...b,
        from_user_name: fromUser?.name || 'Unknown',
        to_user_name: toUser?.name || 'Unknown',
        currency: group.currency || 'EUR'
      };
    });

    res.json({
      ...group,
      members: members.map(m => ({ ...m, is_premium: Boolean(m.is_premium) })),
      balances
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, (req: AuthRequest, res: Response): void => {
  const groupId = parseInt(req.params.id);
  const { name, description, type, cover_color } = req.body;

  try {
    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND created_by = ?').get(groupId, req.userId) as any;
    if (!group) {
      res.status(403).json({ error: 'Not authorized to update this group' });
      return;
    }

    db.prepare(
      'UPDATE groups SET name = ?, description = ?, type = ?, cover_color = ? WHERE id = ?'
    ).run(
      name || group.name,
      description !== undefined ? description : group.description,
      type || group.type,
      cover_color || group.cover_color,
      groupId
    );

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, (req: AuthRequest, res: Response): void => {
  const groupId = parseInt(req.params.id);

  try {
    const group = db.prepare('SELECT * FROM groups WHERE id = ? AND created_by = ?').get(groupId, req.userId);
    if (!group) {
      res.status(403).json({ error: 'Not authorized to delete this group' });
      return;
    }

    // Delete related data
    const expenses = db.prepare('SELECT id FROM expenses WHERE group_id = ?').all(groupId) as any[];
    for (const e of expenses) {
      db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(e.id);
    }
    db.prepare('DELETE FROM expenses WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM payments WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM activities WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);

    res.json({ message: 'Group deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/members', authenticate, (req: AuthRequest, res: Response): void => {
  const groupId = parseInt(req.params.id);
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.userId);
    if (!member) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const user = db.prepare('SELECT id, email, name, avatar_color, currency, is_premium, created_at FROM users WHERE email = ?').get(email) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existingMember = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, user.id);
    if (existingMember) {
      res.status(409).json({ error: 'User is already a member' });
      return;
    }

    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, user.id);

    db.prepare('INSERT INTO activities (group_id, user_id, type, data) VALUES (?, ?, ?, ?)').run(
      groupId, req.userId, 'member_added', JSON.stringify({ added_user: user.name })
    );

    res.status(201).json({ ...user, is_premium: Boolean(user.is_premium) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/members/:userId', authenticate, (req: AuthRequest, res: Response): void => {
  const groupId = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);

  try {
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any;
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Only group creator or the user themselves can remove
    if (group.created_by !== req.userId && targetUserId !== req.userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetUserId);
    res.json({ message: 'Member removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { getGroupBalances };
export default router;
