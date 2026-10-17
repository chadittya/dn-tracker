import http from 'node:http';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './app';
import { getConfig } from './config';
import { startRuntime } from './runtime';

// Dev runs against its own data directory so experiments cannot touch real data.
process.env.DN_DATA_DIR ??= path.resolve(process.cwd(), 'data-dev');

async function main(): Promise<void> {
  const config = getConfig();

  // Vite attaches HMR to this same HTTP server: no second port is opened.
  const server = http.createServer();

  const vite = await createViteServer({
    configFile: path.resolve(process.cwd(), 'vite.config.mts'),
    appType: 'spa',
    server: {
      middlewareMode: true,
      hmr: { server },
    },
  });

  const runtime = await startRuntime(config);

  const app = createApp({
    db: runtime.db,
    backupService: runtime.backupService,
    backupDir: config.backupDir,
    spaMiddleware: [vite.middlewares as unknown as RequestHandler],
  });

  server.on('request', app);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => resolve());
  });

  console.log(
    `Dev server running at http://localhost:${config.port} (bound to ${config.host})`,
  );
  console.log(`Dev data directory: ${config.dataDir}`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down.`);
    await vite.close().catch(() => undefined);
    server.close(() => {
      runtime.stop();
      process.exit(0);
    });
    setTimeout(() => {
      runtime.stop();
      process.exit(0);
    }, 3000).unref();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
