import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendInviteNotification } from '../lib/email';

const router = Router();

async function getGroupBalances(groupId: number) {
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { splits: true },
  });
  const payments = await prisma.payment.findMany({ where: { groupId } });

  // net[userId] = positive means owed money, negative means owes money
  const net: Record<number, number> = {};

  for (const expense of expenses) {
    net[expense.paidById] = (net[expense.paidById] || 0) + expense.amount;
    for (const split of expense.splits) {
      net[split.userId] = (net[split.userId] || 0) - split.amount;
    }
  }
  for (const payment of payments) {
    net[payment.fromUserId] = (net[payment.fromUserId] || 0) + payment.amount;
    net[payment.toUserId] = (net[payment.toUserId] || 0) - payment.amount;
  }

  // Greedy simplification
  const debts: { fromUserId: number; toUserId: number; amount: number }[] = [];
  const creditors = Object.entries(net).filter(([, v]) => v > 0.01).map(([k, v]) => ({ id: Number(k), amount: v }));
  const debtors = Object.entries(net).filter(([, v]) => v < -0.01).map(([k, v]) => ({ id: Number(k), amount: -v }));

  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].amount, debtors[j].amount);
    if (amount > 0.01) debts.push({ fromUserId: debtors[j].id, toUserId: creditors[i].id, amount: Math.round(amount * 100) / 100 });
    creditors[i].amount -= amount;
    debtors[j].amount -= amount;
    if (creditors[i].amount < 0.01) i++;
    if (debtors[j].amount < 0.01) j++;
  }
  return debts;
}

router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        members: { some: { userId: req.userId } },
      },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = await Promise.all(groups.map(async (group) => {
      const balances = await getGroupBalances(group.id);
      let myBalance = 0;
      for (const b of balances) {
        if (b.toUserId === req.userId) myBalance += b.amount;
        if (b.fromUserId === req.userId) myBalance -= b.amount;
      }
      return {
        ...group,
        member_count: group._count.members,
        my_balance: Math.round(myBalance * 100) / 100,
      };
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, type, cover_color, coverColor } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }

  try {
    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        type: type || 'other',
        coverColor: coverColor || cover_color || '#10B981',
        createdById: req.userId!,
        members: {
          create: { userId: req.userId! },
        },
        activities: {
          create: {
            userId: req.userId!,
            type: 'group_created',
            data: { name },
          },
        },
      },
    });

    res.status(201).json(group);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const groupId = parseInt(req.params.id);

  try {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId! } },
    });
    if (!member) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarColor: true,
                currency: true,
                isPremium: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const rawBalances = await getGroupBalances(groupId);
    const memberMap = Object.fromEntries(group.members.map(m => [m.userId, m.user]));

    const balances = rawBalances.map(b => ({
      ...b,
      from_user_name: memberMap[b.fromUserId]?.name || 'Unknown',
      to_user_name: memberMap[b.toUserId]?.name || 'Unknown',
      currency: 'EUR',
    }));

    res.json({
      ...group,
      members: group.members.map(m => m.user),
      balances,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const groupId = parseInt(req.params.id);
  const { name, description, type, cover_color, coverColor } = req.body;

  try {
    const group = await prisma.group.findFirst({
      where: { id: groupId, createdById: req.userId },
    });
    if (!group) {
      res.status(403).json({ error: 'Not authorized to update this group' });
      return;
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(type ? { type } : {}),
        ...((coverColor || cover_color) ? { coverColor: coverColor || cover_color } : {}),
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const groupId = parseInt(req.params.id);

  try {
    const group = await prisma.group.findFirst({
      where: { id: groupId, createdById: req.userId },
    });
    if (!group) {
      res.status(403).json({ error: 'Not authorized to delete this group' });
      return;
    }

    await prisma.group.delete({ where: { id: groupId } });

    res.json({ message: 'Group deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/members', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const groupId = parseInt(req.params.id);
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const currentMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId! } },
    });
    if (!currentMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });
    if (existingMember) {
      res.status(409).json({ error: 'User is already a member' });
      return;
    }

    await prisma.groupMember.create({ data: { groupId, userId: user.id } });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    const inviter = req.user!;

    await prisma.activity.create({
      data: {
        groupId,
        userId: req.userId!,
        type: 'member_added',
        data: { added_user: user.name },
      },
    });

    // Send invite email (non-blocking)
    if (group) {
      sendInviteNotification(user.email, inviter.name, group.name).catch(() => {});
    }

    const { passwordHash, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/members/:userId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const groupId = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);

  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Only group creator or the user themselves can remove
    if (group.createdById !== req.userId && targetUserId !== req.userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    res.json({ message: 'Member removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { getGroupBalances };
export default router;
