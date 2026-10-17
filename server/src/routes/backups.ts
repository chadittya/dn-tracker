import { Router } from 'express';
import { listBackups } from '../backup';

export function createBackupsRouter(backupDir: string): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      res.json({ backups: await listBackups(backupDir) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
