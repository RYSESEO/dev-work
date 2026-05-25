import { Play, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot } from '../../../shared/domain';
import { oneClickTasks } from '../../../shared/oneClickTasks';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function OneClickLaunchers({ snapshot, onRefresh }: Props) {
  const toast = useToast();
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const missionId = snapshot.missions[0]?.id ?? null;

  async function launch(templateId: string): Promise<void> {
    const template = oneClickTasks.find((item) => item.id === templateId);
    if (!template) return;

    const agent = snapshot.agents.find((item) => item.role === template.recommendedAgentRole) ?? snapshot.agents[0];
    if (!agent) return;

    setLaunchingId(templateId);
    try {
      const runnerProfile = snapshot.runnerProfiles.find((p) => p.id === agent.runnerProfileId);
      const workspacePath = runnerProfile?.workspacePath ?? snapshot.runnerProfiles[0]?.workspacePath ?? '';
      const prompt = template.promptTemplate
        .replaceAll('{{workspacePath}}', workspacePath)
        .replaceAll('{{userInput}}', snapshot.missions[0]?.goal ?? '');
      const task = await commandCenterClient.createTask(
        missionId,
        template.title,
        template.description,
        template.riskLevel === 'high' ? 'high' : 'normal'
      );
      await commandCenterClient.launchRun(task.id, agent.id, prompt);
      toast.success(`"${template.title}" launched.`);
      await onRefresh();
    } catch (err) {
      toast.error(`Failed to launch: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLaunchingId(null);
    }
  }

  return (
    <section className="panel launchers-panel">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <Zap size={18} />
        </span>
        <div>
          <h2>One-click tasks</h2>
          <p>Dispatch a focused agent run with a single command.</p>
        </div>
      </div>
      <div className="launcher-grid" aria-label="One-click task templates">
        {oneClickTasks.map((template) => {
          const isLaunching = launchingId === template.id;
          return (
            <button key={template.id} className="launcher-button" disabled={isLaunching} onClick={() => void launch(template.id)}>
              <span className="launcher-topline">
                <ShieldCheck size={16} aria-hidden="true" />
                {template.riskLevel} risk
              </span>
              <strong>{isLaunching ? 'Launching...' : template.title}</strong>
              <span className="launcher-description">{template.description}</span>
              <span className="launcher-footer">
                <span>{template.recommendedAgentRole}</span>
                <Play size={15} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
