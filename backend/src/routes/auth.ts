import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function formatUser(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, name, password, phone } = parsed.data;
  const normalizedPhone = phone ? phone.replace(/[^\d+]/g, '') || undefined : undefined;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const user = await prisma.user.create({
      data: { email, passwordHash, name, avatarColor, ...(normalizedPhone ? { phone: normalizedPhone } : {}) },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({ token, user: formatUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user: formatUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  res.json(formatUser(req.user));
});

export default router;
