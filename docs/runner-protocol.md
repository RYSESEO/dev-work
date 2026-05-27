# Runner Protocol

Runners are execution backends that connect AI providers to Command Center. This document describes how to build a custom runner.

## Runner Interface

Every runner implements the `Runner` interface:

```typescript
interface Runner {
  type: string;
  start(context: RunContext): Promise<RunnerHandle>;
}

interface RunContext {
  runId: string;
  taskTitle: string;
  taskDescription: string;
  workspace: string;
  env: Record<string, string>;
  approvalPolicy: string;
  onMessage: (msg: RunnerToHostMessage) => void;
}

interface RunnerHandle {
  stop(): void;
}
```

## Message Protocol

Runners communicate with the host via `RunnerToHostMessage`:

```typescript
type RunnerToHostMessage =
  | { type: 'log'; level: 'info' | 'warn' | 'error'; text: string }
  | { type: 'artifact'; name: string; content: string; mime: string }
  | { type: 'approval_request'; id: string; tool: string; args: Record<string, unknown>; risk: 'low' | 'medium' | 'high' }
  | { type: 'status'; status: 'completed' | 'failed'; summary: string }
  | { type: 'token_usage'; promptTokens: number; completionTokens: number; model: string };
```

### Message Types

| Type | Purpose | When to Send |
|------|---------|-------------|
| `log` | Progress updates, debug info | Throughout execution |
| `artifact` | Generated files, code, outputs | When agent produces a deliverable |
| `approval_request` | Request permission for risky ops | Before executing shell commands, file writes, etc. |
| `status` | Final completion or failure | Once, at the end of execution |
| `token_usage` | Token consumption metrics | After each API call |

## Building a Command Runner

The simplest runner executes shell commands:

```typescript
import { spawn } from 'node:child_process';
import type { Runner, RunContext, RunnerHandle } from './types';

export const MyRunner: Runner = {
  type: 'my-runner',

  async start(ctx: RunContext): Promise<RunnerHandle> {
    const proc = spawn('my-command', [ctx.taskDescription], {
      cwd: ctx.workspace,
      env: { ...process.env, ...ctx.env }
    });

    proc.stdout.on('data', (data) => {
      ctx.onMessage({ type: 'log', level: 'info', text: data.toString() });
    });

    proc.stderr.on('data', (data) => {
      ctx.onMessage({ type: 'log', level: 'error', text: data.toString() });
    });

    proc.on('close', (code) => {
      ctx.onMessage({
        type: 'status',
        status: code === 0 ? 'completed' : 'failed',
        summary: `Exited with code ${code}`
      });
    });

    return {
      stop() {
        proc.kill('SIGTERM');
      }
    };
  }
};
```

## Building an API Runner

For AI provider runners (OpenAI, Anthropic, etc.):

```typescript
export const AnthropicRunner: Runner = {
  type: 'anthropic',

  async start(ctx: RunContext): Promise<RunnerHandle> {
    let stopped = false;

    (async () => {
      try {
        ctx.onMessage({ type: 'log', level: 'info', text: 'Calling Anthropic API...' });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ctx.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: ctx.env.MODEL || 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: ctx.taskDescription }]
          })
        });

        if (stopped) return;

        const data = await response.json();

        ctx.onMessage({
          type: 'token_usage',
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          model: data.model ?? 'unknown'
        });

        const text = data.content?.[0]?.text ?? '';
        ctx.onMessage({ type: 'artifact', name: 'response.md', content: text, mime: 'text/markdown' });
        ctx.onMessage({ type: 'status', status: 'completed', summary: 'Task completed' });
      } catch (err) {
        if (!stopped) {
          ctx.onMessage({ type: 'status', status: 'failed', summary: String(err) });
        }
      }
    })();

    return {
      stop() {
        stopped = true;
      }
    };
  }
};
```

## Runner Profile Configuration

Runners are configured through runner profiles in Settings:

```typescript
interface RunnerProfile {
  id: string;
  name: string;
  type: 'command' | 'openai' | 'anthropic' | 'ollama' | 'custom-http';
  workspace: string;
  env: Record<string, string>;
}
```

- **type** — Must match your runner's `type` field
- **workspace** — Working directory for the runner
- **env** — Environment variables passed to the runner (API keys, model names, etc.)

## Registering a Runner

Runners are registered in the orchestrator's runner map:

```typescript
// In orchestrator.ts
const runners: Record<string, Runner> = {
  command: CommandRunner,
  openai: OpenAIRunner,
  anthropic: AnthropicRunner  // Your new runner
};
```

For marketplace-distributed runners, use the plugin system to register via the `beforeRunStart` hook.

## Approval Flow

When a runner sends an `approval_request` message:

1. The run pauses (`paused_for_approval` status)
2. The approval request appears in Mission Control
3. The user approves or rejects
4. If approved, the grant is recorded and the run resumes

Approval grants can be configured with glob patterns for auto-approval of known-safe operations.
