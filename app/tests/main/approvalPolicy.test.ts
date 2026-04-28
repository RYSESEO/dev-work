import { describe, expect, it } from 'vitest';
import { grantMatchesRequest } from '../../src/main/services/approvalPolicy.js';
import type { ApprovalGrant, ApprovalRequest } from '../../src/shared/domain.js';

const baseRequest: ApprovalRequest = {
  id: 'approval_request',
  runId: 'run_1',
  title: 'Run tests',
  description: 'Run npm test',
  riskLevel: 'medium',
  scope: { kind: 'command_category', category: 'test' },
  status: 'pending',
  createdAt: '2026-04-27T00:00:00.000Z',
  resolvedAt: null
};

const baseGrant: ApprovalGrant = {
  id: 'grant_1',
  runId: 'run_1',
  requestId: 'approval_request',
  scope: { kind: 'command_category', category: 'test' },
  duration: 'session',
  createdAt: '2026-04-27T00:00:01.000Z'
};

describe('approvalPolicy', () => {
  it('matches same run and same command category', () => {
    expect(grantMatchesRequest(baseGrant, baseRequest)).toBe(true);
  });

  it('does not match a different run', () => {
    expect(grantMatchesRequest({ ...baseGrant, runId: 'run_2' }, baseRequest)).toBe(false);
  });

  it('matches exact command only when command text is identical', () => {
    const grant: ApprovalGrant = { ...baseGrant, scope: { kind: 'command_exact', command: 'npm test' } };
    const request: ApprovalRequest = { ...baseRequest, scope: { kind: 'command_exact', command: 'npm test' } };
    const other: ApprovalRequest = { ...baseRequest, scope: { kind: 'command_exact', command: 'npm run build' } };

    expect(grantMatchesRequest(grant, request)).toBe(true);
    expect(grantMatchesRequest(grant, other)).toBe(false);
  });

  it('matches folder grants for child paths', () => {
    const grant: ApprovalGrant = { ...baseGrant, scope: { kind: 'edit_folder', path: 'C:/repo/src' } };
    const request: ApprovalRequest = { ...baseRequest, scope: { kind: 'edit_files', paths: ['C:/repo/src/App.tsx'] } };

    expect(grantMatchesRequest(grant, request)).toBe(true);
  });
});
