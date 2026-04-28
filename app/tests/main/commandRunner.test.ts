import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CommandRunner } from '../../src/main/runners/commandRunner.js';
import type { RunnerHandle } from '../../src/main/runners/types.js';

describe('CommandRunner', () => {
  it('streams demo agent events and pauses for approval', async () => {
    const runner = new CommandRunner();
    const scriptPath = path.resolve('scripts/demo-agent.mjs');
    const events: string[] = [];
    let handle: RunnerHandle | null = null;

    handle = await runner.start({
      runId: 'run_demo',
      prompt: 'Review workspace',
      profile: {
        id: 'runner_demo',
        name: 'Demo Agent',
        type: 'command',
        command: process.execPath,
        args: [scriptPath],
        workspacePath: process.cwd(),
        env: {},
        costPerThousandTokensUsd: 0.01
      },
      onMessage(message) {
        events.push(message.type);
        if (message.type === 'approval_request') {
          handle?.send({ type: 'approval_result', requestId: message.requestId, approved: true, grantId: 'grant_demo' });
        }
      }
    });

    const result = await handle.done;

    expect(result.exitCode).toBe(0);
    expect(events).toContain('log');
    expect(events).toContain('approval_request');
    expect(events).toContain('usage');
    expect(events).toContain('complete');
  }, 10000);
});
