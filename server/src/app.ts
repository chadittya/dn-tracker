import path from 'node:path';
import express from 'express';
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import type Database from 'better-sqlite3';
import type { BackupService } from './backup';
import { errorHandler } from './errors';
import { getWeekInfo } from './week';
import { createStateRouter } from './routes/state';
import { createCharactersRouter } from './routes/characters';
import { createNestsRouter } from './routes/nests';
import { createRunsRouter } from './routes/runs';
import { createHeraldryRouter } from './routes/heraldry';
import { createBackupsRouter } from './routes/backups';
import { createDataRouter } from './routes/data';

export interface CreateAppOptions {
  db: Database.Database;
  backupService: BackupService;
  backupDir: string;
  now?: () => Date;
  /** SPA middleware mounted after the API routes (Vite in dev, static in prod). */
  spaMiddleware?: RequestHandler[];
}

/**
 * Production static-file + SPA fallback middleware. Uses a path-less
 * middleware because Express 5 no longer accepts `app.get('*')`.
 */
export function createStaticSpaMiddleware(webDist: string): RequestHandler[] {
  return [
    express.static(webDist, { index: false }),
    (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (path.extname(req.path) !== '') return next();
      if (!req.accepts('html')) return next();
      res.sendFile(path.join(webDist, 'index.html'), (error) => {
        if (error) next(error);
      });
    },
  ];
}

export function createApp(options: CreateAppOptions): Express {
  const { db, backupService, backupDir, now = () => new Date() } = options;
  const app = express();

  app.disable('x-powered-by');

  const defaultJson = express.json();
  const importJson = express.json({ limit: '25mb' });
  app.use((req, res, next) => {
    if (req.path === '/api/data/import') {
      importJson(req, res, next);
      return;
    }
    defaultJson(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    const info = getWeekInfo(now());
    res.json({
      ok: true,
      weekKey: info.weekKey,
      nextResetAt: info.nextResetAt.toISOString(),
      serverNow: now().toISOString(),
    });
  });

  app.use('/api/state', createStateRouter(db, now));
  app.use('/api/characters', createCharactersRouter(db));
  app.use('/api/nests', createNestsRouter(db));
  app.use('/api/runs', createRunsRouter(db, now));
  app.use('/api/heraldry', createHeraldryRouter(db));
  app.use('/api/backups', createBackupsRouter(backupDir));
  app.use('/api/data', createDataRouter(db, backupService, now));

  // Unknown API paths must never fall through to the SPA.
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'API endpoint not found.' },
    });
  });

  if (options.spaMiddleware && options.spaMiddleware.length > 0) {
    app.use(options.spaMiddleware);
  }

  app.use(errorHandler);

  return app;
}
