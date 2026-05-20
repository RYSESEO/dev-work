import { describe, expect, it } from 'vitest';
import { createId, isTerminalRunStatus } from '../../src/shared/domain.js';

describe('domain helpers', () => {
  it('creates ids with the requested prefix', () => {
    expect(createId('run')).toMatch(/^run_[a-z0-9]+/);
  });

  it('detects terminal run states', () => {
    expect(isTerminalRunStatus('completed')).toBe(true);
    expect(isTerminalRunStatus('failed')).toBe(true);
    expect(isTerminalRunStatus('stopped')).toBe(true);
    expect(isTerminalRunStatus('running')).toBe(false);
    expect(isTerminalRunStatus('paused_for_approval')).toBe(false);
  });
});
