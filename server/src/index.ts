import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createApp, createStaticSpaMiddleware } from './app';
import { getConfig } from './config';
import { startRuntime } from './runtime';

async function main(): Promise<void> {
  const config = getConfig();

  const indexFile = path.join(config.webDist, 'index.html');
  try {
    await fs.access(indexFile);
  } catch {
    throw new Error(
      `Built frontend not found at ${indexFile}. Run "npm run build" first.`,
    );
  }

  const runtime = await startRuntime(config);

  const app = createApp({
    db: runtime.db,
    backupService: runtime.backupService,
    backupDir: config.backupDir,
    spaMiddleware: createStaticSpaMiddleware(config.webDist),
  });

  const server = http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => resolve());
  });

  console.log(
    `Dragon Nest Run Tracker running at http://localhost:${config.port} (bound to ${config.host})`,
  );
  console.log(`Data directory: ${config.dataDir}`);

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down.`);
    server.close(() => {
      runtime.stop();
      process.exit(0);
    });
    setTimeout(() => {
      runtime.stop();
      process.exit(0);
    }, 3000).unref();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
