import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { requireAuth, requireOrg, requireSuperAdmin } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { sanitize } from './middleware/validate';
import { advancesRouter } from './modules/advances/routes';
import { amcRouter } from './modules/amc/routes';
import { auditRouter } from './modules/audit/routes';
import { authRouter } from './modules/auth/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { dispatchesRouter } from './modules/dispatches/routes';
import { documentsRouter } from './modules/documents/routes';
import { expensesRouter } from './modules/expenses/routes';
import { financeRouter } from './modules/finance/routes';
import { healthRouter } from './modules/health/routes';
import { inventoryRouter } from './modules/inventory/routes';
import { leadsRouter } from './modules/leads/routes';
import { notificationsRouter } from './modules/notifications/routes';
import { orgRouter } from './modules/org/routes';
import { paymentsRouter } from './modules/payments/routes';
import { platformRouter } from './modules/platform/routes';
import { projectsRouter } from './modules/projects/routes';
import { quotationsRouter } from './modules/quotations/routes';
import { reportsRouter } from './modules/reports/routes';
import { permissionsRouter, rolesRouter } from './modules/roles/routes';
import { searchRouter } from './modules/search/routes';
import { ticketsRouter } from './modules/tickets/routes';
import { usersRouter } from './modules/users/routes';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // Behind the Next.js rewrite / a reverse proxy: trust the first hop for req.ip.
  app.set('trust proxy', 1);
  app.set('query parser', 'simple');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.APP_URL.replace(/\/$/, ''), credentials: true }));
  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
        customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
        serializers: { req: (req) => ({ method: req.method, url: req.url, id: req.id }), res: (res) => ({ statusCode: res.statusCode }) },
      }),
    );
  }
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitize);

  const api = Router();
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);

  // Platform (super admin)
  api.use('/platform', requireAuth, requireSuperAdmin, platformRouter);

  // Tenant routes: authenticated user of an organisation.
  const tenant = [requireAuth, requireOrg];
  api.use('/org', ...tenant, orgRouter);
  api.use('/users', ...tenant, usersRouter);
  api.use('/roles', ...tenant, rolesRouter);
  api.use('/permissions', requireAuth, permissionsRouter);
  api.use('/dashboard', ...tenant, dashboardRouter);
  api.use('/leads', ...tenant, leadsRouter);
  api.use('/projects', ...tenant, projectsRouter);
  api.use('/quotations', ...tenant, quotationsRouter);
  api.use('/documents', ...tenant, documentsRouter);
  api.use('/inventory', ...tenant, inventoryRouter);
  api.use('/dispatches', ...tenant, dispatchesRouter);
  api.use('/payments', ...tenant, paymentsRouter);
  api.use('/expenses', ...tenant, expensesRouter);
  api.use('/advances', ...tenant, advancesRouter);
  api.use('/finance', ...tenant, financeRouter);
  api.use('/tickets', ...tenant, ticketsRouter);
  api.use('/amc', ...tenant, amcRouter);
  api.use('/notifications', ...tenant, notificationsRouter);
  api.use('/audit', ...tenant, auditRouter);
  api.use('/reports', ...tenant, reportsRouter);
  api.use('/search', ...tenant, searchRouter);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
