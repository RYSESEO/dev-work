import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { handleLemonSqueezyWebhook, type WebhookEnv } from './licenseWebhookHandler.js';
import { loadWebhookEnv, WebhookConfigError } from './config.js';

const WEBHOOK_PATH = '/webhooks/lemonsqueezy';
const MAX_BODY_BYTES = 1_000_000; // 1 MB guard

function readRawBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

/**
 * Creates a framework-agnostic Node HTTP server for the license webhook.
 *
 * Routes:
 *  - GET  /health                  → liveness probe
 *  - POST /webhooks/lemonsqueezy   → verify + mint + deliver a signed key
 */
export function createWebhookServer(env: WebhookEnv): http.Server {
  return http.createServer((req, res) => {
    void (async () => {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method !== 'POST' || req.url !== WEBHOOK_PATH) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }
      let rawBody: string;
      try {
        rawBody = await readRawBody(req);
      } catch (err) {
        sendJson(res, 413, { error: (err as Error).message });
        return;
      }
      const signature =
        (req.headers['x-signature'] as string | undefined) ?? (req.headers['X-Signature'] as string | undefined);
      const result = await handleLemonSqueezyWebhook(rawBody, signature, env);
      sendJson(res, result.status, result.body);
    })();
  });
}

function main(): void {
  let env: WebhookEnv;
  try {
    env = loadWebhookEnv();
  } catch (err) {
    if (err instanceof WebhookConfigError) {
      console.error(`[license-webhook] configuration error: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8787;
  createWebhookServer(env).listen(port, () => {
    console.log(`[license-webhook] listening on :${port}${WEBHOOK_PATH}`);
  });
}

// Run as a standalone server only when executed directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
