import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { apiLimiter, authLimiter } from './middleware/security';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import groupRoutes from './routes/groups';
import expenseRoutes from './routes/expenses';
import paymentRoutes from './routes/payments';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  // Disable upgrade-insecure-requests: it forces the browser to load JS/CSS
  // over HTTPS even when the app itself is served over plain HTTP (e.g. a
  // LAN deployment with no TLS termination), which silently breaks asset
  // loading and leaves a blank page.
  contentSecurityPolicy: isProd
    ? {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'upgrade-insecure-requests': null,
        },
      }
    : false,
}));
app.use(cors({
  origin: isProd ? true : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8081'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiLimiter);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (isProd) {
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*$/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
