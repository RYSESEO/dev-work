import {
  Activity,
  BarChart3,
  Bot,
  ClipboardCheck,
  GitBranch,
  Package,
  Settings,
  Shield,
  TrendingUp,
  Users,
  type LucideIcon
} from 'lucide-react';

export type AppTab = 'mission' | 'agents' | 'tasks' | 'workflows' | 'marketplace' | 'analytics' | 'team' | 'security' | 'usage' | 'settings';

const tabs: Array<{ id: AppTab; label: string; icon: LucideIcon }> = [
  { id: 'mission', label: 'Mission Control', icon: Activity },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'tasks', label: 'Tasks', icon: ClipboardCheck },
  { id: 'workflows', label: 'Workflows', icon: GitBranch },
  { id: 'marketplace', label: 'Marketplace', icon: Package },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
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
