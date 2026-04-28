import type { ApprovalScope, RiskLevel } from './domain.js';

export type RunnerToHostMessage =
  | { type: 'log'; level: 'info' | 'warning' | 'error'; message: string }
  | { type: 'usage'; estimatedTokens: number; commandCount: number; outputBytes: number }
  | {
      type: 'approval_request';
      requestId: string;
      title: string;
      description: string;
      riskLevel: RiskLevel;
      scope: ApprovalScope;
    }
  | { type: 'artifact'; title: string; path: string; kind: 'log' | 'summary' | 'file' | 'report' }
  | { type: 'complete'; summary: string }
  | { type: 'failed'; message: string };

export type HostToRunnerMessage =
  | { type: 'approval_result'; requestId: string; approved: true; grantId: string }
  | { type: 'approval_result'; requestId: string; approved: false; reason: string }
  | { type: 'stop'; reason: string };
