import type { JSX } from 'react';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardSnapshot } from '../../shared/domain';
import { commandCenterClient } from './api/client';
import { AgentsView } from './components/AgentsView';
import { AnalyticsView } from './components/AnalyticsView';
import { CostUsageView } from './components/CostUsageView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MarketplaceView } from './components/MarketplaceView';
import { MissionControl } from './components/MissionControl';
import { SecurityView } from './components/SecurityView';
import { SettingsView } from './components/SettingsView';
import { TabNav, type AppTab } from './components/TabNav';
import { TasksView } from './components/TasksView';
import { TeamView } from './components/TeamView';
import { ToastProvider } from './components/ToastProvider';
import { WelcomeModal } from './components/WelcomeModal';
import { WorkflowsView } from './components/WorkflowsView';

const ONBOARDING_KEY = 'command-center:onboarding-complete';

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('mission');
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY)
  );
  const knownVersionRef = useRef<number | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await commandCenterClient.getSnapshot(knownVersionRef.current);
      if (result !== null) {
        setSnapshot(result);
        knownVersionRef.current = result.storeVersion;
      }
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

  function completeOnboarding(): void {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  }

  if (error) {
    return (
      <ToastProvider>
        <main className="app-shell app-shell-centered">
          <section className="notice error">
            <span className="notice-kicker">Renderer issue</span>
            <strong>{error}</strong>
          </section>
        </main>
      </ToastProvider>
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
    <ToastProvider>
      <ErrorBoundary fallbackLabel="Application error">
        {showOnboarding && <WelcomeModal onComplete={completeOnboarding} />}
        <div className="product-frame">
          <TabNav active={activeTab} onChange={setActiveTab} />
          <div className="sidebar-content">
            <ErrorBoundary fallbackLabel={`Error in ${activeTab} tab`}>
              {activeTab === 'mission' && <MissionControl snapshot={snapshot} onRefresh={refresh} onNavigate={setActiveTab} />}
              {activeTab === 'agents' && <AgentsView snapshot={snapshot} />}
              {activeTab === 'tasks' && <TasksView snapshot={snapshot} onRefresh={refresh} onNavigate={setActiveTab} />}
              {activeTab === 'workflows' && <WorkflowsView snapshot={snapshot} onRefresh={refresh} />}
              {activeTab === 'marketplace' && <MarketplaceView snapshot={snapshot} onRefresh={refresh} />}
              {activeTab === 'analytics' && <AnalyticsView />}
              {activeTab === 'team' && <TeamView snapshot={snapshot} onRefresh={refresh} />}
              {activeTab === 'security' && <SecurityView snapshot={snapshot} onRefresh={refresh} />}
              {activeTab === 'usage' && <CostUsageView snapshot={snapshot} />}
              {activeTab === 'settings' && <SettingsView snapshot={snapshot} />}
            </ErrorBoundary>
          </div>
        </div>
      </ErrorBoundary>
    </ToastProvider>
  );
}
