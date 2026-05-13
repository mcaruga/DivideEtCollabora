import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function formatUser(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.get('/search', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const q = req.query.q as string;
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters' });
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        email: { contains: q, mode: 'insensitive' },
        id: { not: req.userId },
      },
      take: 10,
    });

    res.json(users.map(formatUser));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, currency, avatarColor, avatar_color, phone } = req.body;
  const colorValue = avatarColor || avatar_color;
  const normalizedPhone = phone !== undefined
    ? (phone === '' ? null : phone.replace(/[^\d+]/g, '') || null)
    : undefined;

  try {
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(name ? { name } : {}),
        ...(currency ? { currency } : {}),
        ...(colorValue ? { avatarColor: colorValue } : {}),
        ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
      },
    });

    res.json(formatUser(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upgrade-premium', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { isPremium: true },
    });

    res.json(formatUser(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
