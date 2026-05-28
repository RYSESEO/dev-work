import type { AppStore } from '../db/appStore.js';
import {
  createId,
  nowIso,
  type Budget,
  type BudgetAction,
  type BudgetPeriod,
  type CostAnomaly,
  type CostForecast,
  type CostIntelligenceSnapshot,
  type ExternalIntegration,
  type ModelCostEntry,
  type Run,
  type UsageEvent,
  type WebhookEvent,
  type WebhookUsagePayload
} from '../../shared/domain.js';

export interface CostIntelligenceService {
  createBudget(name: string, limitUsd: number, period: BudgetPeriod, action: BudgetAction): Budget;
  updateBudget(id: string, update: Partial<Pick<Budget, 'name' | 'limitUsd' | 'period' | 'action' | 'enabled'>>): Budget;
  deleteBudget(id: string): void;
  getBudgets(): Budget[];
  getSnapshot(): CostIntelligenceSnapshot;
  checkBudgets(): Array<{ budget: Budget; pctUsed: number; exceeded: boolean }>;
}

export function createCostIntelligenceService(store: AppStore): CostIntelligenceService {

  function getResetDate(period: BudgetPeriod): string {
    const now = new Date();
    switch (period) {
      case 'daily': {
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        return tomorrow.toISOString();
      }
      case 'weekly': {
        const nextMonday = new Date(now);
        nextMonday.setUTCDate(nextMonday.getUTCDate() + (8 - nextMonday.getUTCDay()) % 7 || 7);
        nextMonday.setUTCHours(0, 0, 0, 0);
        return nextMonday.toISOString();
      }
      case 'monthly': {
        const nextMonth = new Date(now);
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
        nextMonth.setUTCHours(0, 0, 0, 0);
        return nextMonth.toISOString();
      }
    }
  }

  function getPeriodStart(period: BudgetPeriod): Date {
    const now = new Date();
    switch (period) {
      case 'daily': {
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        return start;
      }
      case 'weekly': {
        const start = new Date(now);
        const day = start.getUTCDay();
        start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
        start.setUTCHours(0, 0, 0, 0);
        return start;
      }
      case 'monthly': {
        const start = new Date(now);
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        return start;
      }
    }
  }

  function getSpendInPeriod(period: BudgetPeriod): number {
    const periodStart = getPeriodStart(period);
    const runs = store.getAll<Run>('runs');
    const usage = store.getAll<UsageEvent>('usage');
    const webhookEvents = store.getAll<WebhookEvent>('telemetry')
      .filter((e): e is WebhookEvent => 'integrationId' in e && e.type === 'usage.report');

    let total = 0;

    for (const run of runs) {
      const runDate = run.startedAt ?? run.completedAt;
      if (runDate && new Date(runDate) >= periodStart) {
        total += run.estimatedCostUsd;
      }
    }

    for (const u of usage) {
      if (new Date(u.at) >= periodStart) {
        total += u.estimatedCostUsd;
      }
    }

    for (const e of webhookEvents) {
      if (new Date(e.receivedAt) >= periodStart) {
        const payload = e.payload as WebhookUsagePayload;
        total += payload.costUsd ?? 0;
      }
    }

    return total;
  }

  function computeForecasts(): CostForecast[] {
    const runs = store.getAll<Run>('runs');
    const webhookUsage = store.getAll<WebhookEvent>('telemetry')
      .filter((e): e is WebhookEvent => 'integrationId' in e && e.type === 'usage.report');

    const dailyCosts = new Map<string, { cost: number; tokens: number }>();

    for (const run of runs) {
      const date = (run.startedAt ?? run.completedAt ?? '').slice(0, 10);
      if (!date) continue;
      const entry = dailyCosts.get(date) ?? { cost: 0, tokens: 0 };
      entry.cost += run.estimatedCostUsd;
      entry.tokens += run.estimatedTokens;
      dailyCosts.set(date, entry);
    }

    for (const e of webhookUsage) {
      const date = e.receivedAt.slice(0, 10);
      const payload = e.payload as WebhookUsagePayload;
      const entry = dailyCosts.get(date) ?? { cost: 0, tokens: 0 };
      entry.cost += payload.costUsd ?? 0;
      entry.tokens += payload.tokens ?? 0;
      dailyCosts.set(date, entry);
    }

    const sortedDays = [...dailyCosts.entries()]
      .sort(([a], [b]) => a.localeCompare(b));

    if (sortedDays.length === 0) {
      return [
        { period: 'next_7d', projectedCostUsd: 0, projectedTokens: 0, trend: 'stable', trendPct: 0, confidence: 'low', dailyAvgCostUsd: 0, dailyAvgTokens: 0 },
        { period: 'next_30d', projectedCostUsd: 0, projectedTokens: 0, trend: 'stable', trendPct: 0, confidence: 'low', dailyAvgCostUsd: 0, dailyAvgTokens: 0 }
      ];
    }

    const recentDays = sortedDays.slice(-14);
    const avgCost = recentDays.reduce((sum, [, d]) => sum + d.cost, 0) / recentDays.length;
    const avgTokens = recentDays.reduce((sum, [, d]) => sum + d.tokens, 0) / recentDays.length;

    let trend: CostForecast['trend'] = 'stable';
    let trendPct = 0;

    if (recentDays.length >= 4) {
      const half = Math.floor(recentDays.length / 2);
      const firstHalfAvg = recentDays.slice(0, half).reduce((sum, [, d]) => sum + d.cost, 0) / half;
      const secondHalfAvg = recentDays.slice(half).reduce((sum, [, d]) => sum + d.cost, 0) / (recentDays.length - half);

      if (firstHalfAvg > 0) {
        trendPct = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        if (trendPct > 10) trend = 'increasing';
        else if (trendPct < -10) trend = 'decreasing';
      }
    }

    const confidence: CostForecast['confidence'] = recentDays.length >= 7 ? 'high' : recentDays.length >= 3 ? 'medium' : 'low';

    return [
      {
        period: 'next_7d',
        projectedCostUsd: avgCost * 7,
        projectedTokens: Math.round(avgTokens * 7),
        trend,
        trendPct: Math.round(trendPct * 10) / 10,
        confidence,
        dailyAvgCostUsd: avgCost,
        dailyAvgTokens: Math.round(avgTokens)
      },
      {
        period: 'next_30d',
        projectedCostUsd: avgCost * 30,
        projectedTokens: Math.round(avgTokens * 30),
        trend,
        trendPct: Math.round(trendPct * 10) / 10,
        confidence,
        dailyAvgCostUsd: avgCost,
        dailyAvgTokens: Math.round(avgTokens)
      }
    ];
  }

  function detectAnomalies(): CostAnomaly[] {
    const runs = store.getAll<Run>('runs');
    const webhookUsage = store.getAll<WebhookEvent>('telemetry')
      .filter((e): e is WebhookEvent => 'integrationId' in e && e.type === 'usage.report');

    const anomalies: CostAnomaly[] = [];

    // Compute daily baselines
    const dailyCosts = new Map<string, number>();
    for (const run of runs) {
      const date = (run.startedAt ?? run.completedAt ?? '').slice(0, 10);
      if (!date) continue;
      dailyCosts.set(date, (dailyCosts.get(date) ?? 0) + run.estimatedCostUsd);
    }
    for (const e of webhookUsage) {
      const date = e.receivedAt.slice(0, 10);
      const payload = e.payload as WebhookUsagePayload;
      dailyCosts.set(date, (dailyCosts.get(date) ?? 0) + (payload.costUsd ?? 0));
    }

    const sortedDays = [...dailyCosts.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (sortedDays.length < 3) return anomalies;

    const values = sortedDays.map(([, v]) => v);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

    // Check recent days for cost spikes (> 2 standard deviations)
    const recentDays = sortedDays.slice(-7);
    for (const [date, cost] of recentDays) {
      if (stdDev > 0 && cost > mean + 2 * stdDev) {
        const severity: CostAnomaly['severity'] = cost > mean + 3 * stdDev ? 'high' : 'medium';
        anomalies.push({
          id: createId('anomaly'),
          detectedAt: nowIso(),
          type: 'cost_spike',
          severity,
          description: `Daily cost on ${date} ($${cost.toFixed(4)}) is ${((cost - mean) / stdDev).toFixed(1)}x standard deviations above average ($${mean.toFixed(4)})`,
          value: cost,
          baseline: mean
        });
      }
    }

    // Check for single expensive runs (> 5x average run cost)
    const completedRuns = runs.filter((r) => r.estimatedCostUsd > 0);
    if (completedRuns.length >= 5) {
      const avgRunCost = completedRuns.reduce((sum, r) => sum + r.estimatedCostUsd, 0) / completedRuns.length;
      const recentRuns = completedRuns.slice(-20);
      for (const run of recentRuns) {
        if (run.estimatedCostUsd > avgRunCost * 5 && run.estimatedCostUsd > 0.01) {
          anomalies.push({
            id: createId('anomaly'),
            detectedAt: nowIso(),
            type: 'cost_spike',
            severity: run.estimatedCostUsd > avgRunCost * 10 ? 'high' : 'medium',
            description: `Run cost $${run.estimatedCostUsd.toFixed(4)} is ${(run.estimatedCostUsd / avgRunCost).toFixed(1)}x the average run cost ($${avgRunCost.toFixed(4)})`,
            value: run.estimatedCostUsd,
            baseline: avgRunCost,
            runId: run.id
          });
        }
      }
    }

    return anomalies.slice(-20);
  }

  function computeModelCosts(): ModelCostEntry[] {
    const webhookUsage = store.getAll<WebhookEvent>('telemetry')
      .filter((e): e is WebhookEvent => 'integrationId' in e && e.type === 'usage.report');

    const integrations = store.getAll<ExternalIntegration>('integrations');
    const models = new Map<string, { tokens: number; cost: number; runs: number; provider: string }>();

    // From webhook usage events (have model/provider info)
    for (const e of webhookUsage) {
      const payload = e.payload as WebhookUsagePayload;
      const model = payload.model ?? 'unknown';
      const provider = payload.provider ?? 'unknown';
      const key = `${provider}:${model}`;
      const entry = models.get(key) ?? { tokens: 0, cost: 0, runs: 0, provider };
      entry.tokens += payload.tokens ?? 0;
      entry.cost += payload.costUsd ?? 0;
      entry.runs++;
      models.set(key, entry);
    }

    // From internal runs (use runner profile type as model proxy)
    const runs = store.getAll<Run>('runs');
    for (const run of runs) {
      if (run.estimatedCostUsd <= 0 && run.estimatedTokens <= 0) continue;
      const key = 'internal:local-runner';
      const entry = models.get(key) ?? { tokens: 0, cost: 0, runs: 0, provider: 'internal' };
      entry.tokens += run.estimatedTokens;
      entry.cost += run.estimatedCostUsd;
      entry.runs++;
      models.set(key, entry);
    }

    void integrations;

    return [...models.entries()].map(([key, data]) => {
      const model = key.split(':').slice(1).join(':');
      return {
        model,
        provider: data.provider,
        totalTokens: data.tokens,
        totalCostUsd: data.cost,
        runCount: data.runs,
        avgCostPerRun: data.runs > 0 ? data.cost / data.runs : 0,
        avgTokensPerRun: data.runs > 0 ? Math.round(data.tokens / data.runs) : 0,
        costPer1kTokens: data.tokens > 0 ? (data.cost / data.tokens) * 1000 : 0
      };
    }).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }

  return {
    createBudget(name: string, limitUsd: number, period: BudgetPeriod, action: BudgetAction): Budget {
      const budget: Budget = {
        id: createId('budget'),
        name,
        limitUsd,
        period,
        action,
        spentUsd: getSpendInPeriod(period),
        enabled: true,
        resetAt: getResetDate(period),
        createdAt: nowIso()
      };
      store.put('budgets', budget.id, budget);
      return budget;
    },

    updateBudget(id: string, update: Partial<Pick<Budget, 'name' | 'limitUsd' | 'period' | 'action' | 'enabled'>>): Budget {
      const budget = store.getById<Budget>('budgets', id);
      if (!budget) throw new Error(`Budget ${id} not found`);
      const updated: Budget = {
        ...budget,
        ...update,
        resetAt: update.period ? getResetDate(update.period) : budget.resetAt
      };
      store.put('budgets', id, updated);
      return updated;
    },

    deleteBudget(id: string): void {
      store.remove('budgets', id);
    },

    getBudgets(): Budget[] {
      const budgets = store.getAll<Budget>('budgets');
      // Refresh spend amounts
      for (const budget of budgets) {
        const currentSpend = getSpendInPeriod(budget.period);
        if (currentSpend !== budget.spentUsd) {
          budget.spentUsd = currentSpend;
          store.put('budgets', budget.id, budget);
        }
      }
      return budgets;
    },

    checkBudgets(): Array<{ budget: Budget; pctUsed: number; exceeded: boolean }> {
      const budgets = this.getBudgets().filter((b) => b.enabled);
      return budgets.map((budget) => ({
        budget,
        pctUsed: budget.limitUsd > 0 ? (budget.spentUsd / budget.limitUsd) * 100 : 0,
        exceeded: budget.spentUsd >= budget.limitUsd
      }));
    },

    getSnapshot(): CostIntelligenceSnapshot {
      return {
        budgets: this.getBudgets(),
        forecasts: computeForecasts(),
        anomalies: detectAnomalies(),
        modelCosts: computeModelCosts(),
        totalSpentToday: getSpendInPeriod('daily'),
        totalSpentThisWeek: getSpendInPeriod('weekly'),
        totalSpentThisMonth: getSpendInPeriod('monthly')
      };
    }
  };
}
