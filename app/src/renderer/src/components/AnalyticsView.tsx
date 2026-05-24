import { BarChart3, Clock, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalyticsSnapshot } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';

export function AnalyticsView() {
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const didLoad = useRef(false);

  const loadAnalytics = useCallback(async (): Promise<void> => {
    try {
      setAnalytics(await commandCenterClient.getAnalytics());
    } catch {
      /* analytics is non-critical */
    }
  }, []);

  useEffect(() => {
    if (!didLoad.current) {
      didLoad.current = true;
      void loadAnalytics();
    }
  }, [loadAnalytics]);

  if (!analytics) {
    return (
      <main className="app-shell">
        <header className="view-header">
          <span className="section-label">Insights</span>
          <h1>Analytics</h1>
          <p>Loading analytics data...</p>
        </header>
      </main>
    );
  }

  const successRate = analytics.totalRuns > 0 ? ((analytics.successfulRuns / analytics.totalRuns) * 100).toFixed(1) : '0';
  const avgDuration = analytics.averageRunDurationMs > 0 ? (analytics.averageRunDurationMs / 1000).toFixed(1) : '0';

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Insights</span>
        <h1>Analytics & ROI</h1>
        <p>Track performance, cost savings, and return on investment from agent automation.</p>
      </header>

      <section className="metric-strip analytics-metrics">
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><Zap size={18} /></span>
          <span className="metric-label">Total runs</span>
          <strong className="metric-value">{analytics.totalRuns}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><TrendingUp size={18} /></span>
          <span className="metric-label">Success rate</span>
          <strong className="metric-value">{successRate}%</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><Clock size={18} /></span>
          <span className="metric-label">Avg duration</span>
          <strong className="metric-value">{avgDuration}s</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><DollarSign size={18} /></span>
          <span className="metric-label">Total cost</span>
          <strong className="metric-value">${analytics.totalCostUsd.toFixed(4)}</strong>
        </article>
      </section>

      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true"><TrendingUp size={18} /></span>
            <div>
              <h2>ROI Summary</h2>
              <p>Estimated return on investment from agent automation.</p>
            </div>
          </div>
          <div className="roi-cards">
            <div className="roi-card">
              <span className="roi-label">Time saved</span>
              <strong className="roi-value">{analytics.estimatedTimeSavedHours.toFixed(1)}h</strong>
              <span className="roi-detail">@ $75/hr developer rate</span>
            </div>
            <div className="roi-card">
              <span className="roi-label">Agent costs</span>
              <strong className="roi-value roi-cost">${analytics.totalCostUsd.toFixed(2)}</strong>
              <span className="roi-detail">{analytics.totalTokens.toLocaleString()} tokens used</span>
            </div>
            <div className="roi-card">
              <span className="roi-label">Net savings</span>
              <strong className={`roi-value ${analytics.costSavingsUsd >= 0 ? 'roi-positive' : 'roi-negative'}`}>
                ${analytics.costSavingsUsd.toFixed(2)}
              </strong>
              <span className="roi-detail">{analytics.costSavingsUsd >= 0 ? 'Positive ROI' : 'Costs exceed savings'}</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true"><BarChart3 size={18} /></span>
            <div>
              <h2>Runs by day</h2>
              <p>Activity over time.</p>
            </div>
          </div>
          {analytics.runsByDay.length > 0 ? (
            <div className="chart-container">
              <div className="bar-chart">
                {analytics.runsByDay.map((day) => {
                  const maxCount = Math.max(...analytics.runsByDay.map((d) => d.count), 1);
                  const height = (day.count / maxCount) * 100;
                  return (
                    <div key={day.date} className="bar-column" title={`${day.date}: ${day.count} runs, $${day.cost.toFixed(4)}`}>
                      <div className="bar" style={{ height: `${height}%` }} />
                      <span className="bar-label">{day.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="empty-state">No run data yet.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Zap size={18} /></span>
          <div>
            <h2>Agent performance</h2>
            <p>Run counts and success rates per agent.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Total runs</th>
                <th>Success rate</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topAgents.map((agent) => (
                <tr key={agent.agentId}>
                  <td>{agent.name}</td>
                  <td>{agent.runs}</td>
                  <td>{(agent.successRate * 100).toFixed(0)}%</td>
                  <td>
                    <div className="performance-bar">
                      <div className="performance-fill" style={{ width: `${agent.successRate * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {analytics.topAgents.length === 0 && (
                <tr><td colSpan={4}>No agent data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
