import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createCostIntelligenceService } from '../../src/main/services/costIntelligence.js';
import type { Run, UsageEvent } from '../../src/shared/domain.js';
import { createId, nowIso } from '../../src/shared/domain.js';

describe('cost intelligence service', () => {
  it('creates and retrieves budgets', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    const budget = svc.createBudget('Monthly limit', 50, 'monthly', 'alert');
    expect(budget.name).toBe('Monthly limit');
    expect(budget.limitUsd).toBe(50);
    expect(budget.period).toBe('monthly');
    expect(budget.action).toBe('alert');
    expect(budget.enabled).toBe(true);

    const budgets = svc.getBudgets();
    expect(budgets).toHaveLength(1);
    expect(budgets[0]!.id).toBe(budget.id);
  });

  it('updates budget properties', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    const budget = svc.createBudget('Test', 100, 'weekly', 'alert');
    const updated = svc.updateBudget(budget.id, { limitUsd: 200, action: 'block' });
    expect(updated.limitUsd).toBe(200);
    expect(updated.action).toBe('block');
    expect(updated.name).toBe('Test');
  });

  it('deletes budgets', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    const budget = svc.createBudget('Delete me', 10, 'daily', 'alert');
    expect(svc.getBudgets()).toHaveLength(1);
    svc.deleteBudget(budget.id);
    expect(svc.getBudgets()).toHaveLength(0);
  });

  it('checks budget usage percentage', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    svc.createBudget('Test budget', 10, 'monthly', 'alert');

    const checks = svc.checkBudgets();
    expect(checks).toHaveLength(1);
    expect(checks[0]!.pctUsed).toBe(0);
    expect(checks[0]!.exceeded).toBe(false);
  });

  it('returns empty snapshot when no data exists', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    const snapshot = svc.getSnapshot();
    expect(snapshot.budgets).toHaveLength(0);
    expect(snapshot.forecasts).toHaveLength(2);
    expect(snapshot.anomalies).toHaveLength(0);
    expect(snapshot.modelCosts).toHaveLength(0);
    expect(snapshot.totalSpentToday).toBe(0);
    expect(snapshot.totalSpentThisWeek).toBe(0);
    expect(snapshot.totalSpentThisMonth).toBe(0);
  });

  it('computes forecasts from run data', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    // Add some runs with cost data across multiple days
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const run: Run = {
        id: createId('run'),
        taskId: 'task_1',
        agentProfileId: 'agent_1',
        runnerProfileId: 'runner_1',
        status: 'completed',
        startedAt: date.toISOString(),
        completedAt: date.toISOString(),
        estimatedCostUsd: 0.05,
        estimatedTokens: 500
      };
      store.put('runs', run.id, run);
    }

    const snapshot = svc.getSnapshot();
    expect(snapshot.forecasts).toHaveLength(2);

    const f7d = snapshot.forecasts.find((f) => f.period === 'next_7d');
    expect(f7d).toBeDefined();
    expect(f7d!.projectedCostUsd).toBeGreaterThan(0);
    expect(f7d!.projectedTokens).toBeGreaterThan(0);
    expect(f7d!.confidence).toBe('high');

    const f30d = snapshot.forecasts.find((f) => f.period === 'next_30d');
    expect(f30d).toBeDefined();
    expect(f30d!.projectedCostUsd).toBeGreaterThan(f7d!.projectedCostUsd);
  });

  it('computes model cost breakdown from runs', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    // Add some runs
    for (let i = 0; i < 5; i++) {
      const run: Run = {
        id: createId('run'),
        taskId: 'task_1',
        agentProfileId: 'agent_1',
        runnerProfileId: 'runner_1',
        status: 'completed',
        startedAt: nowIso(),
        completedAt: nowIso(),
        estimatedCostUsd: 0.1,
        estimatedTokens: 1000
      };
      store.put('runs', run.id, run);
    }

    const snapshot = svc.getSnapshot();
    expect(snapshot.modelCosts).toHaveLength(1);
    const model = snapshot.modelCosts[0]!;
    expect(model.model).toBe('local-runner');
    expect(model.provider).toBe('internal');
    expect(model.runCount).toBe(5);
    expect(model.totalTokens).toBe(5000);
    expect(model.totalCostUsd).toBeCloseTo(0.5);
  });

  it('tracks spending in current period', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    // Add a run with today's date
    const run: Run = {
      id: createId('run'),
      taskId: 'task_1',
      agentProfileId: 'agent_1',
      runnerProfileId: 'runner_1',
      status: 'completed',
      startedAt: nowIso(),
      completedAt: nowIso(),
      estimatedCostUsd: 0.25,
      estimatedTokens: 2500
    };
    store.put('runs', run.id, run);

    const snapshot = svc.getSnapshot();
    expect(snapshot.totalSpentToday).toBeCloseTo(0.25);
    expect(snapshot.totalSpentThisWeek).toBeCloseTo(0.25);
    expect(snapshot.totalSpentThisMonth).toBeCloseTo(0.25);
  });

  it('detects cost anomalies in daily spending', async () => {
    const store = await createAppStore(':memory:');
    const svc = createCostIntelligenceService(store);

    // Create consistent baseline (10 days at $0.05/day)
    const now = new Date();
    for (let i = 3; i <= 12; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const run: Run = {
        id: createId('run'),
        taskId: 'task_1',
        agentProfileId: 'agent_1',
        runnerProfileId: 'runner_1',
        status: 'completed',
        startedAt: date.toISOString(),
        completedAt: date.toISOString(),
        estimatedCostUsd: 0.05,
        estimatedTokens: 500
      };
      store.put('runs', run.id, run);
    }

    // Add spike yesterday ($5.00 — 100x baseline)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const spikeRun: Run = {
      id: createId('run'),
      taskId: 'task_1',
      agentProfileId: 'agent_1',
      runnerProfileId: 'runner_1',
      status: 'completed',
      startedAt: yesterday.toISOString(),
      completedAt: yesterday.toISOString(),
      estimatedCostUsd: 5.0,
      estimatedTokens: 50000
    };
    store.put('runs', spikeRun.id, spikeRun);

    const snapshot = svc.getSnapshot();
    expect(snapshot.anomalies.length).toBeGreaterThan(0);
    const costSpike = snapshot.anomalies.find((a) => a.type === 'cost_spike');
    expect(costSpike).toBeDefined();
    expect(costSpike!.severity).toBe('high');
  });
});
