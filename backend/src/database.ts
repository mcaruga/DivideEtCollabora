import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#4F46E5',
    currency TEXT DEFAULT 'EUR',
    is_premium INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'other',
    cover_color TEXT DEFAULT '#4F46E5',
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    paid_by INTEGER NOT NULL,
    split_type TEXT DEFAULT 'equal',
    category TEXT DEFAULT 'general',
    date TEXT NOT NULL,
    notes TEXT,
    receipt_url TEXT,
    is_recurring INTEGER DEFAULT 0,
    recur_interval TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (paid_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS expense_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'EUR',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  avatar_color: string;
  currency: string;
  is_premium: number;
  created_at: string;
}

export interface GroupRow {
  id: number;
  name: string;
  description: string | null;
  type: string;
  cover_color: string;
  created_by: number;
  created_at: string;
}

export interface ExpenseRow {
  id: number;
  group_id: number | null;
  description: string;
  amount: number;
  currency: string;
  paid_by: number;
  split_type: string;
  category: string;
  date: string;
  notes: string | null;
  receipt_url: string | null;
  is_recurring: number;
  recur_interval: string | null;
  created_by: number;
  created_at: string;
}

export interface ExpenseSplitRow {
  id: number;
  expense_id: number;
  user_id: number;
  amount: number;
}

export interface PaymentRow {
  id: number;
  group_id: number | null;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
}

export interface ActivityRow {
  id: number;
  group_id: number | null;
  user_id: number;
  type: string;
  data: string | null;
  created_at: string;
}

export function getGroupBalances(groupId: number): Array<{
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  amount: number;
  currency: string;
}> {
  const expenses = db.prepare(`
    SELECT e.*, u.name as paid_by_name
    FROM expenses e
    JOIN users u ON e.paid_by = u.id
    WHERE e.group_id = ?
  `).all(groupId) as (ExpenseRow & { paid_by_name: string })[];

  const netBalances: Map<number, number> = new Map();
  const userNames: Map<number, string> = new Map();

  for (const expense of expenses) {
    const splits = db.prepare(`
      SELECT es.*, u.name as user_name
      FROM expense_splits es
      JOIN users u ON es.user_id = u.id
      WHERE es.expense_id = ?
    `).all(expense.id) as (ExpenseSplitRow & { user_name: string })[];

    userNames.set(expense.paid_by, expense.paid_by_name);

    for (const split of splits) {
      userNames.set(split.user_id, split.user_name);
      if (split.user_id !== expense.paid_by) {
        netBalances.set(expense.paid_by, (netBalances.get(expense.paid_by) || 0) + split.amount);
        netBalances.set(split.user_id, (netBalances.get(split.user_id) || 0) - split.amount);
      }
    }
  }

  const payments = db.prepare(`
    SELECT p.*,
      fu.name as from_user_name,
      tu.name as to_user_name
    FROM payments p
    JOIN users fu ON p.from_user_id = fu.id
    JOIN users tu ON p.to_user_id = tu.id
    WHERE p.group_id = ?
  `).all(groupId) as (PaymentRow & { from_user_name: string; to_user_name: string })[];

  for (const payment of payments) {
    userNames.set(payment.from_user_id, payment.from_user_name);
    userNames.set(payment.to_user_id, payment.to_user_name);
    netBalances.set(payment.from_user_id, (netBalances.get(payment.from_user_id) || 0) + payment.amount);
    netBalances.set(payment.to_user_id, (netBalances.get(payment.to_user_id) || 0) - payment.amount);
  }

  const result: Array<{
    from_user_id: number;
    from_user_name: string;
    to_user_id: number;
    to_user_name: string;
    amount: number;
    currency: string;
  }> = [];

  const creditors: Array<{ id: number; amount: number }> = [];
  const debtors: Array<{ id: number; amount: number }> = [];

  for (const [userId, balance] of netBalances.entries()) {
    if (balance > 0.005) {
      creditors.push({ id: userId, amount: balance });
    } else if (balance < -0.005) {
      debtors.push({ id: userId, amount: -balance });
    }
  }

  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0.005) {
      result.push({
        from_user_id: debtor.id,
        from_user_name: userNames.get(debtor.id) || 'Unknown',
        to_user_id: creditor.id,
        to_user_name: userNames.get(creditor.id) || 'Unknown',
        amount: Math.round(amount * 100) / 100,
        currency: 'EUR',
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < 0.005) ci++;
    if (debtor.amount < 0.005) di++;
  }

  return result;
}

export function simplifyDebts(groupId: number): Array<{
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  amount: number;
  currency: string;
}> {
  const expenses = db.prepare(`
    SELECT e.*, u.name as paid_by_name
    FROM expenses e
    JOIN users u ON e.paid_by = u.id
    WHERE e.group_id = ?
  `).all(groupId) as (ExpenseRow & { paid_by_name: string })[];

  const netBalances: Map<number, number> = new Map();
  const userNames: Map<number, string> = new Map();

  for (const expense of expenses) {
    const splits = db.prepare(`
      SELECT es.*, u.name as user_name
      FROM expense_splits es
      JOIN users u ON es.user_id = u.id
      WHERE es.expense_id = ?
    `).all(expense.id) as (ExpenseSplitRow & { user_name: string })[];

    userNames.set(expense.paid_by, expense.paid_by_name);

    for (const split of splits) {
      userNames.set(split.user_id, split.user_name);
      if (split.user_id !== expense.paid_by) {
        netBalances.set(expense.paid_by, (netBalances.get(expense.paid_by) || 0) + split.amount);
        netBalances.set(split.user_id, (netBalances.get(split.user_id) || 0) - split.amount);
      }
    }
  }

  const payments = db.prepare(`
    SELECT p.*,
      fu.name as from_user_name,
      tu.name as to_user_name
    FROM payments p
    JOIN users fu ON p.from_user_id = fu.id
    JOIN users tu ON p.to_user_id = tu.id
    WHERE p.group_id = ?
  `).all(groupId) as (PaymentRow & { from_user_name: string; to_user_name: string })[];

  for (const payment of payments) {
    userNames.set(payment.from_user_id, payment.from_user_name);
    userNames.set(payment.to_user_id, payment.to_user_name);
    netBalances.set(payment.from_user_id, (netBalances.get(payment.from_user_id) || 0) + payment.amount);
    netBalances.set(payment.to_user_id, (netBalances.get(payment.to_user_id) || 0) - payment.amount);
  }

  const balanceList: Array<{ id: number; amount: number }> = [];
  for (const [userId, balance] of netBalances.entries()) {
    if (Math.abs(balance) > 0.005) {
      balanceList.push({ id: userId, amount: Math.round(balance * 100) / 100 });
    }
  }

  const result: Array<{
    from_user_id: number;
    from_user_name: string;
    to_user_id: number;
    to_user_name: string;
    amount: number;
    currency: string;
  }> = [];

  while (balanceList.length >= 2) {
    balanceList.sort((a, b) => a.amount - b.amount);
    const minBalance = balanceList[0];
    const maxBalance = balanceList[balanceList.length - 1];

    if (minBalance.amount >= -0.005 || maxBalance.amount <= 0.005) break;

    const amount = Math.min(Math.abs(minBalance.amount), maxBalance.amount);

    if (amount > 0.005) {
      result.push({
        from_user_id: minBalance.id,
        from_user_name: userNames.get(minBalance.id) || 'Unknown',
        to_user_id: maxBalance.id,
        to_user_name: userNames.get(maxBalance.id) || 'Unknown',
        amount: Math.round(amount * 100) / 100,
        currency: 'EUR',
      });
    }

    minBalance.amount += amount;
    maxBalance.amount -= amount;

    const toRemove: number[] = [];
    for (let i = 0; i < balanceList.length; i++) {
      if (Math.abs(balanceList[i].amount) < 0.005) {
        toRemove.push(i);
      }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      balanceList.splice(toRemove[i], 1);
    }
  }

  return result;
}
