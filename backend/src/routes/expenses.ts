import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.get('/group/:groupId', authenticate, (req: AuthRequest, res: Response): void => {
  const groupId = parseInt(req.params.groupId);

  try {
    const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, req.userId);
    if (!member) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const expenses = db.prepare(`
      SELECT e.*, u.name as paid_by_name
      FROM expenses e
      JOIN users u ON e.paid_by = u.id
      WHERE e.group_id = ?
      ORDER BY e.date DESC, e.created_at DESC
    `).all(groupId) as any[];

    const result = expenses.map(expense => {
      const splits = db.prepare(`
        SELECT es.*, u.name as user_name
        FROM expense_splits es
        JOIN users u ON es.user_id = u.id
        WHERE es.expense_id = ?
      `).all(expense.id) as any[];
      return { ...expense, splits, is_recurring: Boolean(expense.is_recurring) };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, upload.single('receipt'), (req: AuthRequest, res: Response): void => {
  const {
    group_id, description, amount, currency, paid_by,
    split_type, splits, category, date, notes, is_recurring, recur_interval
  } = req.body;

  if (!description || !amount || !paid_by || !date) {
    res.status(400).json({ error: 'Description, amount, paid_by, and date are required' });
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

    const parsedAmount = parseFloat(amount);
    const parsedSplits = typeof splits === 'string' ? JSON.parse(splits) : splits;
    const receipt_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate splits sum to amount
    if (parsedSplits && parsedSplits.length > 0) {
      const total = parsedSplits.reduce((sum: number, s: any) => sum + parseFloat(s.amount), 0);
      if (Math.abs(total - parsedAmount) > 0.01) {
        res.status(400).json({ error: `Splits total (${total.toFixed(2)}) must equal expense amount (${parsedAmount.toFixed(2)})` });
        return;
      }
    }

    const result = db.prepare(`
      INSERT INTO expenses (group_id, description, amount, currency, paid_by, split_type, category, date, notes, receipt_url, is_recurring, recur_interval, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      group_id || null,
      description,
      parsedAmount,
      currency || 'EUR',
      parseInt(paid_by),
      split_type || 'equal',
      category || 'general',
      date,
      notes || null,
      receipt_url,
      is_recurring ? 1 : 0,
      recur_interval || null,
      req.userId
    );

    const expenseId = result.lastInsertRowid;

    // Insert splits
    if (parsedSplits && parsedSplits.length > 0) {
      const insertSplit = db.prepare('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)');
      for (const split of parsedSplits) {
        insertSplit.run(expenseId, parseInt(split.user_id), parseFloat(split.amount));
      }
    }

    // Log activity
    if (group_id) {
      db.prepare('INSERT INTO activities (group_id, user_id, type, data) VALUES (?, ?, ?, ?)').run(
        group_id, req.userId, 'expense_added', JSON.stringify({ description, amount: parsedAmount, currency: currency || 'EUR' })
      );
    }

    const expense = db.prepare(`
      SELECT e.*, u.name as paid_by_name FROM expenses e
      JOIN users u ON e.paid_by = u.id WHERE e.id = ?
    `).get(expenseId) as any;

    const expenseSplits = db.prepare(`
      SELECT es.*, u.name as user_name FROM expense_splits es
      JOIN users u ON es.user_id = u.id WHERE es.expense_id = ?
    `).all(expenseId);

    res.status(201).json({ ...expense, splits: expenseSplits, is_recurring: Boolean(expense.is_recurring) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, upload.single('receipt'), (req: AuthRequest, res: Response): void => {
  const expenseId = parseInt(req.params.id);
  const { description, amount, currency, paid_by, split_type, splits, category, date, notes, is_recurring, recur_interval } = req.body;

  try {
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND created_by = ?').get(expenseId, req.userId) as any;
    if (!expense) {
      res.status(403).json({ error: 'Not authorized to update this expense' });
      return;
    }

    const parsedAmount = amount ? parseFloat(amount) : expense.amount;
    const parsedSplits = splits ? (typeof splits === 'string' ? JSON.parse(splits) : splits) : null;
    const receipt_url = req.file ? `/uploads/${req.file.filename}` : expense.receipt_url;

    db.prepare(`
      UPDATE expenses SET description = ?, amount = ?, currency = ?, paid_by = ?,
      split_type = ?, category = ?, date = ?, notes = ?, receipt_url = ?,
      is_recurring = ?, recur_interval = ? WHERE id = ?
    `).run(
      description || expense.description,
      parsedAmount,
      currency || expense.currency,
      paid_by ? parseInt(paid_by) : expense.paid_by,
      split_type || expense.split_type,
      category || expense.category,
      date || expense.date,
      notes !== undefined ? notes : expense.notes,
      receipt_url,
      is_recurring !== undefined ? (is_recurring ? 1 : 0) : expense.is_recurring,
      recur_interval !== undefined ? recur_interval : expense.recur_interval,
      expenseId
    );

    if (parsedSplits && parsedSplits.length > 0) {
      db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(expenseId);
      const insertSplit = db.prepare('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES (?, ?, ?)');
      for (const split of parsedSplits) {
        insertSplit.run(expenseId, parseInt(split.user_id), parseFloat(split.amount));
      }
    }

    const updated = db.prepare(`
      SELECT e.*, u.name as paid_by_name FROM expenses e
      JOIN users u ON e.paid_by = u.id WHERE e.id = ?
    `).get(expenseId) as any;

    const updatedSplits = db.prepare(`
      SELECT es.*, u.name as user_name FROM expense_splits es
      JOIN users u ON es.user_id = u.id WHERE es.expense_id = ?
    `).all(expenseId);

    res.json({ ...updated, splits: updatedSplits, is_recurring: Boolean(updated.is_recurring) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, (req: AuthRequest, res: Response): void => {
  const expenseId = parseInt(req.params.id);

  try {
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ? AND created_by = ?').get(expenseId, req.userId);
    if (!expense) {
      res.status(403).json({ error: 'Not authorized to delete this expense' });
      return;
    }

    db.prepare('DELETE FROM expense_splits WHERE expense_id = ?').run(expenseId);
    db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);

    res.json({ message: 'Expense deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
