import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../lib/cloudinary';
import { sendExpenseNotification } from '../lib/email';

const router = Router();

router.get('/group/:groupId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const groupId = parseInt(req.params.groupId);

  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId! } },
    });
    if (!member) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const result = expenses.map(expense => ({
      ...expense,
      paid_by_name: expense.paidBy.name,
      splits: expense.splits.map(s => ({
        id: s.id,
        expense_id: s.expenseId,
        user_id: s.userId,
        amount: s.amount,
        user_name: s.user.name,
      })),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, upload.single('receipt'), async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    group_id, groupId: groupIdBody, description, amount, currency, paid_by, paidById: paidByIdBody,
    split_type, splitType, splits, category, date, notes, is_recurring, isRecurring, recur_interval, recurInterval,
  } = req.body;

  const resolvedGroupId = group_id || groupIdBody;
  const resolvedPaidById = paid_by || paidByIdBody;
  const resolvedSplitType = split_type || splitType;
  const resolvedIsRecurring = is_recurring !== undefined ? is_recurring : isRecurring;
  const resolvedRecurInterval = recur_interval || recurInterval;

  if (!description || !amount || !resolvedPaidById || !date) {
    res.status(400).json({ error: 'Description, amount, paid_by, and date are required' });
    return;
  }

  try {
    if (resolvedGroupId) {
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: parseInt(resolvedGroupId), userId: req.userId! } },
      });
      if (!member) {
        res.status(403).json({ error: 'Not a member of this group' });
        return;
      }
    }

    const parsedAmount = parseFloat(amount);
    const parsedSplits = typeof splits === 'string' ? JSON.parse(splits) : (splits || []);
    const receiptUrl = (req.file as any)?.path || (req.file ? `/uploads/${req.file.filename}` : null);

    // Validate splits sum to amount
    if (parsedSplits && parsedSplits.length > 0) {
      const total = parsedSplits.reduce((sum: number, s: any) => sum + parseFloat(s.amount), 0);
      if (Math.abs(total - parsedAmount) > 0.01) {
        res.status(400).json({ error: `Splits total (${total.toFixed(2)}) must equal expense amount (${parsedAmount.toFixed(2)})` });
        return;
      }
    }

    const expense = await prisma.expense.create({
      data: {
        groupId: resolvedGroupId ? parseInt(resolvedGroupId) : null,
        description,
        amount: parsedAmount,
        currency: currency || 'EUR',
        paidById: parseInt(resolvedPaidById),
        splitType: resolvedSplitType || 'equal',
        category: category || 'general',
        date: new Date(date),
        notes: notes || null,
        receiptUrl,
        isRecurring: resolvedIsRecurring ? true : false,
        recurInterval: resolvedRecurInterval || null,
        createdById: req.userId!,
        splits: parsedSplits && parsedSplits.length > 0 ? {
          create: parsedSplits.map((s: any) => ({
            userId: parseInt(s.user_id || s.userId),
            amount: parseFloat(s.amount),
          })),
        } : undefined,
      },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    // Log activity
    if (resolvedGroupId) {
      await prisma.activity.create({
        data: {
          groupId: parseInt(resolvedGroupId),
          userId: req.userId!,
          type: 'expense_added',
          data: { description, amount: parsedAmount, currency: currency || 'EUR' },
        },
      });

      // Send email notifications to split members (except payer) - non-blocking
      const payer = req.user!;
      const group = await prisma.group.findUnique({ where: { id: parseInt(resolvedGroupId) } });
      if (group) {
        for (const split of expense.splits) {
          if (split.userId !== expense.paidById) {
            const splitUser = await prisma.user.findUnique({ where: { id: split.userId } });
            if (splitUser) {
              sendExpenseNotification(
                splitUser.email,
                splitUser.name,
                payer.name,
                group.name,
                description,
                parsedAmount,
                currency || 'EUR',
                split.amount
              ).catch(() => {});
            }
          }
        }
      }
    }

    res.status(201).json({
      ...expense,
      paid_by_name: expense.paidBy.name,
      splits: expense.splits.map(s => ({
        id: s.id,
        expense_id: s.expenseId,
        user_id: s.userId,
        amount: s.amount,
        user_name: s.user.name,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, upload.single('receipt'), async (req: AuthRequest, res: Response): Promise<void> => {
  const expenseId = parseInt(req.params.id);
  const {
    description, amount, currency, paid_by, paidById: paidByIdBody,
    split_type, splitType, splits, category, date, notes,
    is_recurring, isRecurring, recur_interval, recurInterval,
  } = req.body;

  try {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, createdById: req.userId },
    });
    if (!expense) {
      res.status(403).json({ error: 'Not authorized to update this expense' });
      return;
    }

    const parsedAmount = amount ? parseFloat(amount) : expense.amount;
    const parsedSplits = splits ? (typeof splits === 'string' ? JSON.parse(splits) : splits) : null;
    const receiptUrl = (req.file as any)?.path || (req.file ? `/uploads/${req.file.filename}` : expense.receiptUrl);
    const resolvedPaidById = paid_by || paidByIdBody;
    const resolvedSplitType = split_type || splitType;
    const resolvedIsRecurring = is_recurring !== undefined ? is_recurring : isRecurring;
    const resolvedRecurInterval = recur_interval !== undefined ? recur_interval : recurInterval;

    if (parsedSplits && parsedSplits.length > 0) {
      await prisma.expenseSplit.deleteMany({ where: { expenseId } });
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(description ? { description } : {}),
        amount: parsedAmount,
        ...(currency ? { currency } : {}),
        ...(resolvedPaidById ? { paidById: parseInt(resolvedPaidById) } : {}),
        ...(resolvedSplitType ? { splitType: resolvedSplitType } : {}),
        ...(category ? { category } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(notes !== undefined ? { notes } : {}),
        receiptUrl,
        ...(resolvedIsRecurring !== undefined ? { isRecurring: Boolean(resolvedIsRecurring) } : {}),
        ...(resolvedRecurInterval !== undefined ? { recurInterval: resolvedRecurInterval } : {}),
        ...(parsedSplits && parsedSplits.length > 0 ? {
          splits: {
            create: parsedSplits.map((s: any) => ({
              userId: parseInt(s.user_id || s.userId),
              amount: parseFloat(s.amount),
            })),
          },
        } : {}),
      },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    res.json({
      ...updated,
      paid_by_name: updated.paidBy.name,
      splits: updated.splits.map(s => ({
        id: s.id,
        expense_id: s.expenseId,
        user_id: s.userId,
        amount: s.amount,
        user_name: s.user.name,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const expenseId = parseInt(req.params.id);

  try {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, createdById: req.userId },
    });
    if (!expense) {
      res.status(403).json({ error: 'Not authorized to delete this expense' });
      return;
    }

    await prisma.expense.delete({ where: { id: expenseId } });

    res.json({ message: 'Expense deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
