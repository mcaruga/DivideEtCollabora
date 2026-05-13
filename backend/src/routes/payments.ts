import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSettlementNotification } from '../lib/email';

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

    const payments = await prisma.payment.findMany({
      where: { groupId },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = payments.map(p => ({
      ...p,
      from_user_name: p.fromUser.name,
      to_user_name: p.toUser.name,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { group_id, groupId: groupIdBody, from_user_id, fromUserId: fromUserIdBody, to_user_id, toUserId: toUserIdBody, amount, currency, notes } = req.body;

  const resolvedGroupId = group_id || groupIdBody;
  const resolvedFromUserId = from_user_id || fromUserIdBody;
  const resolvedToUserId = to_user_id || toUserIdBody;

  if (!resolvedFromUserId || !resolvedToUserId || !amount) {
    res.status(400).json({ error: 'from_user_id, to_user_id, and amount are required' });
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

    const payment = await prisma.payment.create({
      data: {
        groupId: resolvedGroupId ? parseInt(resolvedGroupId) : null,
        fromUserId: parseInt(resolvedFromUserId),
        toUserId: parseInt(resolvedToUserId),
        amount: parseFloat(amount),
        currency: currency || 'EUR',
        notes: notes || null,
      },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (resolvedGroupId) {
      await prisma.activity.create({
        data: {
          groupId: parseInt(resolvedGroupId),
          userId: req.userId!,
          type: 'payment_made',
          data: {
            from: payment.fromUser.name,
            to: payment.toUser.name,
            amount: parseFloat(amount),
            currency: currency || 'EUR',
          },
        },
      });
    }

    // Send settlement notification (non-blocking)
    sendSettlementNotification(
      payment.toUser.email,
      payment.toUser.name,
      payment.fromUser.name,
      parseFloat(amount),
      currency || 'EUR'
    ).catch(() => {});

    res.status(201).json({
      ...payment,
      from_user_name: payment.fromUser.name,
      to_user_name: payment.toUser.name,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
