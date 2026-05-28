#!/usr/bin/env node

/**
 * dev-work GitHub Actions Reporter
 *
 * Sends CI/CD events to the dev-work webhook API.
 * Can either auto-track a command (run + report start/complete/fail)
 * or send a specific event type.
 */

const { execSync, spawnSync } = require('child_process');
const https = require('http');

// Read inputs from environment (GitHub Actions convention)
const apiKey = process.env['INPUT_API-KEY'] || process.env['DEVWORK_API_KEY'];
const host = process.env['INPUT_HOST'] || '127.0.0.1';
const port = parseInt(process.env['INPUT_PORT'] || '9400', 10);
const agentName = process.env['INPUT_AGENT-NAME'] || 'github-actions';
const eventType = process.env['INPUT_EVENT-TYPE'] || 'auto';
const runCommand = process.env['INPUT_RUN-COMMAND'] || '';

// GitHub context
const repo = process.env['GITHUB_REPOSITORY'] || 'unknown/unknown';
const sha = process.env['GITHUB_SHA'] || 'unknown';
const ref = process.env['GITHUB_REF'] || 'unknown';
const workflow = process.env['GITHUB_WORKFLOW'] || 'unknown';
const runNumber = process.env['GITHUB_RUN_NUMBER'] || '0';
const actor = process.env['GITHUB_ACTOR'] || 'unknown';

function generateRunId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `cirun_${ts}_${rand}`;
}

async function sendEvent(type, payload) {
  const body = JSON.stringify({ type, payload });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port,
        path: '/api/v1/events',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(`API error (${res.statusCode}): ${parsed.error || data}`));
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error(`Invalid response: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function setOutput(name, value) {
  const outputFile = process.env['GITHUB_OUTPUT'];
  if (outputFile) {
    const fs = require('fs');
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

async function autoTrack() {
  if (!runCommand) {
    // No command — just send pipeline metadata as a run.completed
    const result = await sendEvent('run.completed', {
      runId: generateRunId(),
      agentName,
      status: 'completed',
      output: `Pipeline ${workflow} #${runNumber} completed`,
      metadata: {
        repo,
        sha: sha.slice(0, 8),
        ref,
        workflow,
        runNumber,
        actor
      }
    });
    setOutput('event-id', result.id);
    console.log(`[dev-work] Pipeline event sent (id: ${result.id})`);
    return;
  }

  const runId = generateRunId();
  const startTime = Date.now();

  // Report start
  try {
    await sendEvent('run.started', {
      runId,
      agentName,
      status: 'started',
      prompt: runCommand,
      metadata: { repo, sha: sha.slice(0, 8), ref, workflow, runNumber, actor }
    });
  } catch (err) {
    console.warn(`[dev-work] Warning: Failed to report start: ${err.message}`);
  }

  setOutput('run-id', runId);

  // Execute command
  const result = spawnSync(runCommand, {
    shell: true,
    stdio: 'inherit',
    env: process.env
  });

  const durationMs = Date.now() - startTime;
  const exitCode = result.status ?? 1;

  setOutput('duration-ms', String(durationMs));
  setOutput('exit-code', String(exitCode));

  // Report result
  try {
    if (exitCode === 0) {
      const resp = await sendEvent('run.completed', {
        runId,
        agentName,
        status: 'completed',
        output: `Command succeeded: ${runCommand}`,
        durationMs,
        metadata: { repo, sha: sha.slice(0, 8), ref, workflow, exitCode: '0' }
      });
      setOutput('event-id', resp.id);
      console.log(`[dev-work] Run completed (${durationMs}ms, id: ${resp.id})`);
    } else {
      const resp = await sendEvent('run.failed', {
        runId,
        agentName,
        status: 'failed',
        error: `Command failed with exit code ${exitCode}: ${runCommand}`,
        durationMs,
        metadata: { repo, sha: sha.slice(0, 8), ref, workflow, exitCode: String(exitCode) }
      });
      setOutput('event-id', resp.id);
      console.log(`[dev-work] Run failed (exit ${exitCode}, ${durationMs}ms, id: ${resp.id})`);
    }
  } catch (err) {
    console.warn(`[dev-work] Warning: Failed to report result: ${err.message}`);
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

async function sendSpecificEvent() {
  const runId = generateRunId();
  const metadata = { repo, sha: sha.slice(0, 8), ref, workflow, runNumber, actor };

  let payload;
  switch (eventType) {
    case 'run.started':
      payload = { runId, agentName, status: 'started', prompt: `${workflow} #${runNumber}`, metadata };
      break;
    case 'run.completed':
      payload = { runId, agentName, status: 'completed', output: `${workflow} #${runNumber} completed`, metadata };
      break;
    case 'run.failed':
      payload = { runId, agentName, status: 'failed', error: `${workflow} #${runNumber} failed`, metadata };
      break;
    case 'heartbeat':
      payload = { agentName, version: `github-actions/${workflow}` };
      break;
    default:
      throw new Error(`Unsupported event type: ${eventType}`);
  }

  const result = await sendEvent(eventType, payload);
  setOutput('event-id', result.id);
  setOutput('run-id', runId);
  console.log(`[dev-work] Event sent: ${eventType} (id: ${result.id})`);
}

async function main() {
  if (!apiKey) {
    console.error('[dev-work] Error: API key required. Set the api-key input or DEVWORK_API_KEY secret.');
    process.exit(1);
  }

  if (eventType === 'auto') {
    await autoTrack();
  } else {
    await sendSpecificEvent();
  }
}

main().catch((err) => {
  console.error(`[dev-work] Error: ${err.message}`);
  process.exit(1);
});
