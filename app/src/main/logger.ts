import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3;

let logDir: string | null = null;
let logStream: fs.WriteStream | null = null;
let currentFile = '';
let minLevel: LogLevel = 'info';

function getAppDataPath(): string {
  try {
    // Dynamic import to avoid breaking in test environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron');
    return app.getPath('userData');
  } catch {
    return path.join(os.tmpdir(), 'command-center-logs');
  }
}

function ensureLogDir(): string {
  if (!logDir) {
    logDir = path.join(getAppDataPath(), 'logs');
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

function rotateIfNeeded(): void {
  if (!logStream || !currentFile) return;
  try {
    const stats = fs.statSync(currentFile);
    if (stats.size < MAX_FILE_SIZE) return;
  } catch {
    return;
  }

  logStream.end();
  logStream = null;

  const dir = ensureLogDir();
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
    .sort()
    .reverse();

  while (files.length >= MAX_FILES) {
    const oldest = files.pop();
    if (oldest) fs.unlinkSync(path.join(dir, oldest));
  }

  openLogFile();
}

function openLogFile(): void {
  const dir = ensureLogDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  currentFile = path.join(dir, `app-${stamp}.log`);
  logStream = fs.createWriteStream(currentFile, { flags: 'a' });
}

function formatMessage(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level.toUpperCase()}] [${scope}] ${message}${metaStr}\n`;
}

function write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const line = formatMessage(level, scope, message, meta);

  if (!logStream) openLogFile();
  logStream?.write(line);
  rotateIfNeeded();

  if (level === 'error') {
    process.stderr.write(line);
  }
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

function createScopedLogger(scope: string): Logger {
  return {
    debug: (msg, meta) => write('debug', scope, msg, meta),
    info: (msg, meta) => write('info', scope, msg, meta),
    warn: (msg, meta) => write('warn', scope, msg, meta),
    error: (msg, meta) => write('error', scope, msg, meta),
    child: (childScope) => createScopedLogger(`${scope}:${childScope}`)
  };
}

export const logger = createScopedLogger('main');

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogPath(): string {
  return currentFile || ensureLogDir();
}
