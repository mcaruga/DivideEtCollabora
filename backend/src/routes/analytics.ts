import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/spending', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { groupId, period } = req.query;
  const months = period === '12' ? 12 : period === '6' ? 6 : 3;

  try {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const where: any = {
      userId: req.userId,
      expense: {
        date: { gte: since },
      },
    };

    if (groupId) {
      where.expense.groupId = parseInt(groupId as string);
    }

    const splits = await prisma.expenseSplit.findMany({
      where,
      include: { expense: { select: { date: true } } },
    });

    // Group by month
    const monthMap: Record<string, number> = {};
    for (const split of splits) {
      const month = split.expense.date.toISOString().slice(0, 7);
      monthMap[month] = (monthMap[month] || 0) + split.amount;
    }

    // Fill in missing months with 0
    const result: { month: string; total: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      result.push({ month: monthStr, total: Math.round((monthMap[monthStr] || 0) * 100) / 100 });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { groupId } = req.query;

  try {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const where: any = {
      userId: req.userId,
      expense: {
        date: { gte: since },
      },
    };

    if (groupId) {
      where.expense.groupId = parseInt(groupId as string);
    }

    const splits = await prisma.expenseSplit.findMany({
      where,
      include: { expense: { select: { category: true } } },
    });

    const categoryMap: Record<string, number> = {};
    for (const split of splits) {
      const cat = split.expense.category;
      categoryMap[cat] = (categoryMap[cat] || 0) + split.amount;
    }

    const result = Object.entries(categoryMap)
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/csv', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { groupId } = req.query;

  try {
    let memberCheck = null;
    if (groupId) {
      memberCheck = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: parseInt(groupId as string), userId: req.userId! } },
      });
      if (!memberCheck) {
        res.status(403).json({ error: 'Not a member of this group' });
        return;
      }
    }

    const where: any = groupId
      ? { groupId: parseInt(groupId as string) }
      : { group: { members: { some: { userId: req.userId } } } };

    const expenses = await prisma.expense.findMany({
      where,
      include: { paidBy: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const headers = ['Date', 'Description', 'Amount', 'Currency', 'Category', 'Paid By', 'Split Type'];
    const rows = expenses.map(e => [
      e.date.toISOString().slice(0, 10),
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount,
      e.currency,
      e.category,
      `"${e.paidBy.name.replace(/"/g, '""')}"`,
      e.splitType,
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
