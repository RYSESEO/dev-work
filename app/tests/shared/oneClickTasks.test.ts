import { describe, expect, it } from 'vitest';
import { oneClickTasks } from '../../src/shared/oneClickTasks.js';

describe('oneClickTasks', () => {
  it('ships with software-building launchers', () => {
    const ids = oneClickTasks.map((task) => task.id);

    expect(ids).toEqual([
      'review-repo',
      'plan-feature',
      'fix-failing-tests',
      'implementation-plan',
      'summarize-changes',
      'code-review',
      'draft-pr-notes'
    ]);
  });

  it('declares risk, prompt, and expected approval scopes for each launcher', () => {
    for (const task of oneClickTasks) {
      expect(task.title.length).toBeGreaterThan(4);
      expect(task.promptTemplate).toContain('{{workspacePath}}');
      expect(['low', 'medium', 'high']).toContain(task.riskLevel);
      expect(task.expectedScopes.length).toBeGreaterThan(0);
    }
  });
});
