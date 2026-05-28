import { spawn } from 'node:child_process';
import type { ClientConfig } from '../http.js';
import { sendEvent } from '../http.js';

function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `run_${ts}_${rand}`;
}

export async function runCommand(config: ClientConfig, args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: dw-agent run <command> [args...]');
    console.error('Example: dw-agent run -- npm test');
    process.exit(1);
  }

  const command = args[0]!;
  const commandArgs = args.slice(1);
  const runId = generateRunId();
  const fullCommand = [command, ...commandArgs].join(' ');
  const startTime = Date.now();

  console.log(`[dw-agent] Tracking: ${fullCommand}`);
  console.log(`[dw-agent] Run ID: ${runId}`);

  // Report run started
  try {
    await sendEvent(config, 'run.started', {
      runId,
      agentName: config.agentName,
      status: 'started',
      prompt: fullCommand,
      metadata: {
        cwd: process.cwd(),
        command,
        args: commandArgs.join(' ')
      }
    });
    console.log('[dw-agent] Run started event sent');
  } catch (err) {
    console.error(`[dw-agent] Warning: Failed to report run.started: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Spawn the child process
  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env
  });

  let output = '';

  // Capture output if piped
  if (child.stdout) {
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
  }

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => {
      console.error(`[dw-agent] Process error: ${err.message}`);
      resolve(1);
    });
  });

  const durationMs = Date.now() - startTime;
  const succeeded = exitCode === 0;

  // Report completion or failure
  try {
    if (succeeded) {
      await sendEvent(config, 'run.completed', {
        runId,
        agentName: config.agentName,
        status: 'completed',
        output: output.slice(-2000) || `Command completed with exit code ${exitCode}`,
        durationMs,
        metadata: {
          exitCode: String(exitCode),
          command: fullCommand
        }
      });
      console.log(`[dw-agent] Run completed (${durationMs}ms)`);
    } else {
      await sendEvent(config, 'run.failed', {
        runId,
        agentName: config.agentName,
        status: 'failed',
        error: `Process exited with code ${exitCode}`,
        output: output.slice(-2000) || undefined,
        durationMs,
        metadata: {
          exitCode: String(exitCode ?? 'null'),
          command: fullCommand
        }
      });
      console.log(`[dw-agent] Run failed (exit code ${exitCode}, ${durationMs}ms)`);
    }
  } catch (err) {
    console.error(`[dw-agent] Warning: Failed to report completion: ${err instanceof Error ? err.message : String(err)}`);
  }

  process.exit(exitCode ?? 1);
}
