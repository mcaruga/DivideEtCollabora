import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
}

router.use(authenticate);
router.use(requireAdmin);

router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, premiumUsers, totalGroups, totalExpenses, amountAgg] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isPremium: true } }),
      prisma.group.count(),
      prisma.expense.count(),
      prisma.expense.aggregate({ _sum: { amount: true } }),
    ]);

    res.json({
      totalUsers,
      premiumUsers,
      totalGroups,
      totalExpenses,
      totalAmountProcessed: Math.round((amountAgg._sum.amount || 0) * 100) / 100,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;

  try {
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { memberships: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map(u => {
        const { passwordHash, ...rest } = u;
        return { ...rest, groupCount: u._count.memberships };
      }),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = parseInt(req.params.id);
  const { isActive, isPremium, isAdmin } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isPremium !== undefined ? { isPremium } : {}),
        ...(isAdmin !== undefined ? { isAdmin } : {}),
      },
    });

    const { passwordHash, ...rest } = updated;
    res.json(rest);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = parseInt(req.params.id);

  try {
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'User deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/groups', async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { members: true, expenses: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count(),
    ]);

    res.json({
      groups: groups.map(g => ({
        ...g,
        memberCount: g._count.members,
        expenseCount: g._count.expenses,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
