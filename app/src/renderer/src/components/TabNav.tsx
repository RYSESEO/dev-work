import {
  Activity,
  BarChart3,
  Bot,
  ClipboardCheck,
  Settings,
  type LucideIcon
} from 'lucide-react';

export type AppTab = 'mission' | 'agents' | 'tasks' | 'usage' | 'settings';

const tabs: Array<{ id: AppTab; label: string; icon: LucideIcon }> = [
  { id: 'mission', label: 'Mission Control', icon: Activity },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings }
];

export function TabNav({ active, onChange }: { active: AppTab; onChange(tab: AppTab): void }) {
  return (
    <nav className="tab-nav" aria-label="Command center sections">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <Activity size={18} />
        </span>
        <span>Command Center</span>
      </div>
      {tabs.map((tab) => (
        <button key={tab.id} className={tab.id === active ? 'tab active' : 'tab'} onClick={() => onChange(tab.id)}>
          <tab.icon size={17} aria-hidden="true" />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
