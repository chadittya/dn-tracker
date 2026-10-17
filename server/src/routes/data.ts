import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { BackupService } from '../backup';
import { exportData, importData } from '../transfer';

export function createDataRouter(
  db: Database.Database,
  backupService: BackupService,
  now: () => Date,
): Router {
  const router = Router();

  router.get('/export', (_req, res) => {
    res.json(exportData(db, now()));
  });

  router.post('/import', async (req, res, next) => {
    try {
      const result = await importData(db, req.body, backupService, now);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
