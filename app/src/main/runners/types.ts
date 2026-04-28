import type { RunnerProfile } from '../../shared/domain.js';
import type { HostToRunnerMessage, RunnerToHostMessage } from '../../shared/runnerProtocol.js';

export interface RunnerStartRequest {
  runId: string;
  prompt: string;
  profile: RunnerProfile;
  onMessage(message: RunnerToHostMessage): void;
}

export interface RunnerResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export interface RunnerHandle {
  done: Promise<RunnerResult>;
  send(message: HostToRunnerMessage): void;
  stop(reason: string): void;
}

export interface Runner {
  start(request: RunnerStartRequest): Promise<RunnerHandle>;
}
