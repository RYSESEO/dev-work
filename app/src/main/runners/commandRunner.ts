import { spawn } from 'node:child_process';
import readline from 'node:readline';
import type { HostToRunnerMessage, RunnerToHostMessage } from '../../shared/runnerProtocol.js';
import type { Runner, RunnerHandle, RunnerResult, RunnerStartRequest } from './types.js';

export class CommandRunner implements Runner {
  async start(request: RunnerStartRequest): Promise<RunnerHandle> {
    const child = spawn(request.profile.command, request.profile.args, {
      cwd: request.profile.workspacePath,
      env: {
        ...process.env,
        ...request.profile.env,
        COMMAND_CENTER_RUN_ID: request.runId,
        COMMAND_CENTER_PROMPT: request.prompt,
        COMMAND_CENTER_WORKSPACE: request.profile.workspacePath
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const stdout = readline.createInterface({ input: child.stdout });
    stdout.on('line', (line) => {
      const parsed = parseRunnerLine(line);
      if (parsed) request.onMessage(parsed);
      if (!parsed && line.trim()) request.onMessage({ type: 'log', level: 'info', message: line });
    });

    const stderr = readline.createInterface({ input: child.stderr });
    stderr.on('line', (line) => {
      request.onMessage({ type: 'log', level: 'error', message: line });
    });

    const done = new Promise<RunnerResult>((resolve) => {
      child.on('exit', (exitCode, signal) => resolve({ exitCode, signal }));
    });

    return {
      done,
      send(message: HostToRunnerMessage): void {
        child.stdin.write(`${JSON.stringify(message)}\n`);
      },
      stop(reason: string): void {
        child.stdin.write(`${JSON.stringify({ type: 'stop', reason } satisfies HostToRunnerMessage)}\n`);
        child.kill();
      }
    };
  }
}

function parseRunnerLine(line: string): RunnerToHostMessage | null {
  try {
    const parsed = JSON.parse(line) as RunnerToHostMessage;
    if (typeof parsed.type === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}
