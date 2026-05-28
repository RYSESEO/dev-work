import { AlertTriangle, DollarSign, Plus, Target, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Budget,
  BudgetAction,
  BudgetPeriod,
  CostAnomaly,
  CostForecast,
  CostIntelligenceSnapshot,
  ModelCostEntry
} from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

export function CostIntelligenceView() {
  const [data, setData] = useState<CostIntelligenceSnapshot | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>('monthly');
  const [budgetAction, setBudgetAction] = useState<BudgetAction>('alert');
  const [isCreating, setIsCreating] = useState(false);
  const toast = useToast();
  const didLoad = useRef(false);

  const load = useCallback(async () => {
    try {
      setData(await commandCenterClient.getCostIntelligence());
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (!didLoad.current) {
      didLoad.current = true;
      void load();
    }
  }, [load]);

  async function handleCreateBudget() {
    const limit = parseFloat(budgetLimit);
    if (!budgetName.trim() || isNaN(limit) || limit <= 0) {
      toast.error('Enter a valid name and limit');
      return;
    }
    setIsCreating(true);
    try {
      await commandCenterClient.createBudget(budgetName.trim(), limit, budgetPeriod, budgetAction);
      toast.success('Budget created');
      setBudgetName('');
      setBudgetLimit('');
      setShowBudgetForm(false);
      await load();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleBudget(budget: Budget) {
    try {
      await commandCenterClient.updateBudget(budget.id, { enabled: !budget.enabled });
      await load();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDeleteBudget(id: string) {
    try {
      await commandCenterClient.deleteBudget(id);
      toast.success('Budget deleted');
      await load();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!data) {
    return (
      <main className="app-shell">
        <header className="view-header">
          <span className="section-label">Insights</span>
          <h1>Cost Intelligence</h1>
          <p>Loading cost data...</p>
        </header>
      </main>
    );
  }

  const forecast7d = data.forecasts.find((f) => f.period === 'next_7d');
  const forecast30d = data.forecasts.find((f) => f.period === 'next_30d');

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Insights</span>
        <h1>Cost Intelligence</h1>
        <p>Budget tracking, cost forecasting, model comparison, and anomaly detection.</p>
      </header>

      {/* Spending summary */}
      <section className="metric-strip">
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><DollarSign size={18} /></span>
          <span className="metric-label">Today</span>
          <strong className="metric-value">${data.totalSpentToday.toFixed(4)}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><DollarSign size={18} /></span>
          <span className="metric-label">This week</span>
          <strong className="metric-value">${data.totalSpentThisWeek.toFixed(4)}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><DollarSign size={18} /></span>
          <span className="metric-label">This month</span>
          <strong className="metric-value">${data.totalSpentThisMonth.toFixed(4)}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true">
            {forecast7d?.trend === 'increasing' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          </span>
          <span className="metric-label">7-day forecast</span>
          <strong className="metric-value">${(forecast7d?.projectedCostUsd ?? 0).toFixed(4)}</strong>
        </article>
      </section>

      <div className="analytics-grid">
        {/* Budgets */}
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true"><Target size={18} /></span>
            <div>
              <h2>Budgets</h2>
              <p>Set spending limits with automatic alerts or enforcement.</p>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => setShowBudgetForm(!showBudgetForm)}>
              <Plus size={14} /> Add
            </button>
          </div>

          {showBudgetForm && (
            <div className="form-row" style={{ gap: '0.5rem', flexWrap: 'wrap', padding: '0 1rem 1rem' }}>
              <input className="input" placeholder="Budget name" value={budgetName} onChange={(e) => setBudgetName(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
              <input className="input" type="number" step="0.01" min="0" placeholder="Limit ($)" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} style={{ width: '100px' }} />
              <select className="input" value={budgetPeriod} onChange={(e) => setBudgetPeriod(e.target.value as BudgetPeriod)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <select className="input" value={budgetAction} onChange={(e) => setBudgetAction(e.target.value as BudgetAction)}>
                <option value="alert">Alert only</option>
                <option value="throttle">Throttle</option>
                <option value="block">Block</option>
              </select>
              <button className="btn btn-sm btn-primary" onClick={handleCreateBudget} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          )}

          {data.budgets.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Limit</th>
                    <th>Spent</th>
                    <th>Usage</th>
                    <th>Period</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.budgets.map((b) => {
                    const pct = b.limitUsd > 0 ? (b.spentUsd / b.limitUsd) * 100 : 0;
                    const exceeded = pct >= 100;
                    const warning = pct >= 80;
                    return (
                      <tr key={b.id}>
                        <td>{b.name}</td>
                        <td>${b.limitUsd.toFixed(2)}</td>
                        <td>${b.spentUsd.toFixed(4)}</td>
                        <td>
                          <div className="performance-bar">
                            <div
                              className="performance-fill"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                background: exceeded ? 'var(--error, #ef4444)' : warning ? 'var(--warning, #f59e0b)' : undefined
                              }}
                            />
                          </div>
                          <small>{pct.toFixed(1)}%</small>
                        </td>
                        <td>{b.period}</td>
                        <td><span className="badge">{b.action}</span></td>
                        <td>
                          <button className="btn btn-sm" onClick={() => handleToggleBudget(b)} title={b.enabled ? 'Disable' : 'Enable'}>
                            {b.enabled ? 'On' : 'Off'}
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteBudget(b.id)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">No budgets configured. Add one to track spending limits.</p>
          )}
        </section>

        {/* Forecasts */}
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true"><TrendingUp size={18} /></span>
            <div>
              <h2>Cost Forecast</h2>
              <p>Projected spending based on recent usage trends.</p>
            </div>
          </div>
          <div className="roi-cards">
            <ForecastCard forecast={forecast7d} label="Next 7 days" />
            <ForecastCard forecast={forecast30d} label="Next 30 days" />
          </div>
        </section>
      </div>

      {/* Model cost comparison */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><DollarSign size={18} /></span>
          <div>
            <h2>Model Cost Comparison</h2>
            <p>Cost efficiency across models and providers.</p>
          </div>
        </div>
        {data.modelCosts.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Runs</th>
                  <th>Total tokens</th>
                  <th>Total cost</th>
                  <th>$/1k tokens</th>
                  <th>Avg $/run</th>
                </tr>
              </thead>
              <tbody>
                {data.modelCosts.map((m) => (
                  <ModelCostRow key={`${m.provider}:${m.model}`} entry={m} maxCost={data.modelCosts[0]?.totalCostUsd ?? 1} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No model usage data yet. Usage events with model info will appear here.</p>
        )}
      </section>

      {/* Anomalies */}
      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><AlertTriangle size={18} /></span>
          <div>
            <h2>Anomaly Detection</h2>
            <p>Unusual spending patterns detected automatically.</p>
          </div>
        </div>
        {data.anomalies.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Value</th>
                  <th>Baseline</th>
                  <th>Detected</th>
                </tr>
              </thead>
              <tbody>
                {data.anomalies.map((a) => (
                  <AnomalyRow key={a.id} anomaly={a} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No anomalies detected. Anomalies appear when spending deviates significantly from historical patterns.</p>
        )}
      </section>
    </main>
  );
}

function ForecastCard({ forecast, label }: { forecast: CostForecast | undefined; label: string }) {
  if (!forecast) {
    return (
      <div className="roi-card">
        <span className="roi-label">{label}</span>
        <strong className="roi-value">$0.00</strong>
        <span className="roi-detail">No data</span>
      </div>
    );
  }

  const trendIcon = forecast.trend === 'increasing' ? '↑' : forecast.trend === 'decreasing' ? '↓' : '→';
  const trendClass = forecast.trend === 'increasing' ? 'roi-negative' : forecast.trend === 'decreasing' ? 'roi-positive' : '';

  return (
    <div className="roi-card">
      <span className="roi-label">{label}</span>
      <strong className={`roi-value ${trendClass}`}>
        ${forecast.projectedCostUsd.toFixed(2)} {trendIcon}
      </strong>
      <span className="roi-detail">
        {forecast.trendPct !== 0 ? `${forecast.trendPct > 0 ? '+' : ''}${forecast.trendPct.toFixed(1)}% trend` : 'Stable'} · {forecast.confidence} confidence
      </span>
      <span className="roi-detail">
        ~{forecast.dailyAvgTokens.toLocaleString()} tokens/day · ${forecast.dailyAvgCostUsd.toFixed(4)}/day
      </span>
    </div>
  );
}

function ModelCostRow({ entry, maxCost }: { entry: ModelCostEntry; maxCost: number }) {
  const barWidth = maxCost > 0 ? (entry.totalCostUsd / maxCost) * 100 : 0;
  return (
    <tr>
      <td><strong>{entry.model}</strong></td>
      <td>{entry.provider}</td>
      <td>{entry.runCount}</td>
      <td>{entry.totalTokens.toLocaleString()}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="performance-bar" style={{ width: '60px' }}>
            <div className="performance-fill" style={{ width: `${barWidth}%` }} />
          </div>
          ${entry.totalCostUsd.toFixed(4)}
        </div>
      </td>
      <td>${entry.costPer1kTokens.toFixed(4)}</td>
      <td>${entry.avgCostPerRun.toFixed(4)}</td>
    </tr>
  );
}

function AnomalyRow({ anomaly }: { anomaly: CostAnomaly }) {
  const severityColor = anomaly.severity === 'high' ? 'var(--error, #ef4444)' : anomaly.severity === 'medium' ? 'var(--warning, #f59e0b)' : 'var(--text-secondary)';
  return (
    <tr>
      <td><span className="badge" style={{ background: severityColor, color: '#fff' }}>{anomaly.severity}</span></td>
      <td>{anomaly.type.replace(/_/g, ' ')}</td>
      <td>{anomaly.description}</td>
      <td>${anomaly.value.toFixed(4)}</td>
      <td>${anomaly.baseline.toFixed(4)}</td>
      <td>{new Date(anomaly.detectedAt).toLocaleDateString()}</td>
    </tr>
  );
}
