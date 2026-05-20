import type { JSX } from 'react';

import { useCallback, useEffect, useState } from 'react';
import type { DashboardSnapshot } from '../../shared/domain';
import { commandCenterClient } from './api/client';
import { AgentsView } from './components/AgentsView';
import { CostUsageView } from './components/CostUsageView';
import { MissionControl } from './components/MissionControl';
import { SettingsView } from './components/SettingsView';
import { TabNav, type AppTab } from './components/TabNav';
import { TasksView } from './components/TasksView';

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('mission');

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setSnapshot(await commandCenterClient.getSnapshot());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard.');
    }
  }, []);

  useEffect(() => {
    let timer: number | null = null;

    function poll(): void {
      void refresh();
    }

    function startPolling(): void {
      stopPolling();
      timer = window.setInterval(poll, 3000);
    }

    function stopPolling(): void {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function handleVisibility(): void {
      if (document.hidden) {
        stopPolling();
      } else {
        poll();
        startPolling();
      }
    }

    poll();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  if (error) {
    return (
      <main className="app-shell app-shell-centered">
        <section className="notice error">
          <span className="notice-kicker">Renderer issue</span>
          <strong>{error}</strong>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="app-shell app-shell-centered">
        <section className="notice skeleton-notice" aria-live="polite">
          <span className="notice-kicker">Starting workspace</span>
          <strong>Loading command center...</strong>
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </section>
      </main>
    );
  }

  return (
    <div className="product-frame">
      <TabNav active={activeTab} onChange={setActiveTab} />
      {activeTab === 'mission' && <MissionControl snapshot={snapshot} onRefresh={refresh} />}
      {activeTab === 'agents' && <AgentsView snapshot={snapshot} />}
      {activeTab === 'tasks' && <TasksView snapshot={snapshot} />}
      {activeTab === 'usage' && <CostUsageView snapshot={snapshot} />}
      {activeTab === 'settings' && <SettingsView snapshot={snapshot} />}
    </div>
  );
}
