import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Middleware to check premium
function requirePremium(req: AuthRequest, res: Response, next: any): void {
  if (!req.user || !req.user.is_premium) {
    res.status(403).json({ error: 'Premium subscription required' });
    return;
  }
  next();
}

router.get('/spending', authenticate, requirePremium, (req: AuthRequest, res: Response): void => {
  const { groupId, period } = req.query;
  const months = period === '12' ? 12 : period === '6' ? 6 : 3;

  try {
    let query = `
      SELECT strftime('%Y-%m', e.date) as month, SUM(es.amount) as total
      FROM expenses e
      JOIN expense_splits es ON e.id = es.expense_id
      WHERE es.user_id = ?
      AND e.date >= date('now', '-${months} months')
    `;
    const params: any[] = [req.userId];

    if (groupId) {
      query += ' AND e.group_id = ?';
      params.push(parseInt(groupId as string));
    }

    query += ' GROUP BY month ORDER BY month ASC';

    const data = db.prepare(query).all(...params) as { month: string; total: number }[];

    // Fill in missing months with 0
    const result: { month: string; total: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      const found = data.find(d => d.month === monthStr);
      result.push({ month: monthStr, total: found ? Math.round(found.total * 100) / 100 : 0 });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', authenticate, requirePremium, (req: AuthRequest, res: Response): void => {
  const { groupId } = req.query;

  try {
    let query = `
      SELECT e.category, SUM(es.amount) as total
      FROM expenses e
      JOIN expense_splits es ON e.id = es.expense_id
      WHERE es.user_id = ?
      AND e.date >= date('now', '-12 months')
    `;
    const params: any[] = [req.userId];

    if (groupId) {
      query += ' AND e.group_id = ?';
      params.push(parseInt(groupId as string));
    }

    query += ' GROUP BY e.category ORDER BY total DESC';

    const data = db.prepare(query).all(...params) as { category: string; total: number }[];
    res.json(data.map(d => ({ ...d, total: Math.round(d.total * 100) / 100 })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/per-person', authenticate, requirePremium, (req: AuthRequest, res: Response): void => {
  const { groupId } = req.query;

  try {
    let query = `
      SELECT u.name, u.id, SUM(es.amount) as total
      FROM expenses e
      JOIN expense_splits es ON e.id = es.expense_id
      JOIN users u ON es.user_id = u.id
      WHERE e.date >= date('now', '-12 months')
    `;
    const params: any[] = [];

    if (groupId) {
      query += ' AND e.group_id = ?';
      params.push(parseInt(groupId as string));

      // Ensure requester is a member
      const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(parseInt(groupId as string), req.userId);
      if (!member) {
        res.status(403).json({ error: 'Not a member of this group' });
        return;
      }
    } else {
      // Only show groups user is in
      query += ` AND e.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)`;
      params.push(req.userId);
    }

    query += ' GROUP BY u.id, u.name ORDER BY total DESC';

    const data = db.prepare(query).all(...params) as { name: string; id: number; total: number }[];
    res.json(data.map(d => ({ ...d, total: Math.round(d.total * 100) / 100 })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/csv', authenticate, requirePremium, (req: AuthRequest, res: Response): void => {
  const { groupId } = req.query;

  try {
    let query = `
      SELECT e.date, e.description, e.amount, e.currency, e.category,
             u.name as paid_by_name, e.split_type
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
    `;
    const params: any[] = [];

    if (groupId) {
      const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(parseInt(groupId as string), req.userId);
      if (!member) {
        res.status(403).json({ error: 'Not a member of this group' });
        return;
      }
      query += ' WHERE e.group_id = ?';
      params.push(parseInt(groupId as string));
    } else {
      query += ` WHERE e.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)`;
      params.push(req.userId);
    }

    query += ' ORDER BY e.date DESC';

    const expenses = db.prepare(query).all(...params) as any[];

    const headers = ['Date', 'Description', 'Amount', 'Currency', 'Category', 'Paid By', 'Split Type'];
    const rows = expenses.map(e => [
      e.date,
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount,
      e.currency,
      e.category,
      `"${e.paid_by_name.replace(/"/g, '""')}"`,
      e.split_type
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
