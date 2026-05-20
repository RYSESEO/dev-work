import { describe, expect, it } from 'vitest';
import { OpenAIRunner } from '../../src/main/runners/openaiRunner.js';
import type { RunnerToHostMessage } from '../../src/shared/runnerProtocol.js';

describe('OpenAIRunner', () => {
  it('rejects non-openai profiles', async () => {
    const runner = new OpenAIRunner();
    await expect(
      runner.start({
        runId: 'run_test',
        prompt: 'test',
        profile: {
          id: 'runner_cmd',
          name: 'Command',
          type: 'command',
          command: 'echo',
          args: [],
          workspacePath: '.',
          env: {},
          costPerThousandTokensUsd: 0
        },
        onMessage: () => {}
      })
    ).rejects.toThrow("OpenAIRunner requires an 'openai' profile");
  });

  it('emits failed when OPENAI_API_KEY is missing', async () => {
    const runner = new OpenAIRunner();
    const events: RunnerToHostMessage[] = [];

    const handle = await runner.start({
      runId: 'run_test',
      prompt: 'test',
      profile: {
        id: 'runner_openai',
        name: 'OpenAI',
        type: 'openai',
        model: 'gpt-4',
        workspacePath: '.',
        env: {},
        costPerThousandTokensUsd: 0.03,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant.'
      },
      onMessage: (msg) => events.push(msg)
    });

    const result = await handle.done;

    expect(result.exitCode).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('failed');
  });
});
