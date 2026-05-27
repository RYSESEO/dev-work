#!/usr/bin/env node

/**
 * Demo Webhook Agent — Simulates an external agent (e.g., Cursor, Copilot) sending
 * events to the dev-work webhook API.
 *
 * Usage:
 *   node scripts/demo-webhook.mjs <api-key> [host] [port]
 *
 * Example:
 *   node scripts/demo-webhook.mjs dw_abc123... 127.0.0.1 9400
 */

const API_KEY = process.argv[2];
const HOST = process.argv[3] || '127.0.0.1';
const PORT = process.argv[4] || '9400';

if (!API_KEY) {
  console.error('Usage: node scripts/demo-webhook.mjs <api-key> [host] [port]');
  process.exit(1);
}

const BASE_URL = `http://${HOST}:${PORT}`;

async function send(body) {
  const res = await fetch(`${BASE_URL}/api/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  console.log(`[${res.status}] ${body.type} →`, data);
  return data;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log(`\nDemo webhook agent → ${BASE_URL}\n`);

// 1. Health check
const status = await fetch(`${BASE_URL}/api/v1/status`);
console.log('Health:', await status.json());

await delay(500);

// 2. Run started
await send({
  type: 'run.started',
  payload: {
    runId: 'demo-ext-run-001',
    agentName: 'Cursor',
    status: 'started',
    prompt: 'Refactor the authentication module to use JWT tokens',
    metadata: { model: 'gpt-4o', workspace: '/home/user/my-app' }
  }
});

await delay(1000);

// 3. Progress update
await send({
  type: 'run.progress',
  payload: {
    runId: 'demo-ext-run-001',
    agentName: 'Cursor',
    status: 'running',
    output: 'Analyzing auth.ts... Found 3 functions to refactor.',
    metadata: { filesAnalyzed: '3' }
  }
});

await delay(800);

// 4. Usage report
await send({
  type: 'usage.report',
  payload: {
    runId: 'demo-ext-run-001',
    tokens: 4200,
    costUsd: 0.126,
    model: 'gpt-4o',
    provider: 'openai'
  }
});

await delay(600);

// 5. Artifact
await send({
  type: 'artifact.created',
  payload: {
    runId: 'demo-ext-run-001',
    title: 'Refactoring Summary',
    kind: 'summary',
    content: 'Converted 3 functions from session-based to JWT auth. Added token refresh middleware.'
  }
});

await delay(500);

// 6. Run completed
await send({
  type: 'run.completed',
  payload: {
    runId: 'demo-ext-run-001',
    agentName: 'Cursor',
    status: 'completed',
    output: 'Successfully refactored auth module. All tests pass.',
    durationMs: 32000,
    metadata: { filesChanged: '4', testsRun: '12', testsPassed: '12' }
  }
});

await delay(300);

// 7. Second usage report
await send({
  type: 'usage.report',
  payload: {
    tokens: 1800,
    costUsd: 0.054,
    model: 'claude-3.5-sonnet',
    provider: 'anthropic'
  }
});

// 8. Heartbeat
await send({
  type: 'heartbeat',
  payload: {
    agentName: 'Cursor',
    version: '0.45.2',
    uptime: 3600
  }
});

console.log('\nDemo complete. Check the Integrations tab in the dashboard.');
