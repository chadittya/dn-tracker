import path from 'node:path';

export interface AppConfig {
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
  backupDir: string;
  webDist: string;
}

const DEFAULT_PORT = 3000;

function resolvePort(value: number | string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${String(value)}`);
  }
  return port;
}

export function getConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const dataDir =
    overrides.dataDir ??
    process.env.DN_DATA_DIR ??
    path.resolve(process.cwd(), 'data');

  const config: AppConfig = {
    host: '127.0.0.1',
    port: resolvePort(overrides.port ?? process.env.PORT),
    dataDir,
    dbPath: path.join(dataDir, 'app.db'),
    backupDir: path.join(dataDir, 'backups'),
    webDist: path.resolve(process.cwd(), 'dist/web'),
  };

  return {
    ...config,
    ...overrides,
    host: '127.0.0.1',
    dataDir: overrides.dataDir ?? config.dataDir,
    dbPath: overrides.dbPath ?? path.join(overrides.dataDir ?? config.dataDir, 'app.db'),
    backupDir:
      overrides.backupDir ??
      path.join(overrides.dataDir ?? config.dataDir, 'backups'),
  };
}
