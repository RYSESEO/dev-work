import {
  Activity,
  BarChart3,
  Bot,
  ClipboardCheck,
  DollarSign,
  GitBranch,
  Network,
  Package,
  Plug,
  Settings,
  Shield,
  TrendingUp,
  Users,
  type LucideIcon
} from 'lucide-react';
import { useEffect } from 'react';

export type AppTab = 'mission' | 'agents' | 'tasks' | 'workflows' | 'collaboration' | 'marketplace' | 'analytics' | 'costs' | 'team' | 'security' | 'usage' | 'integrations' | 'settings';

interface NavGroup {
  label: string;
  items: Array<{ id: AppTab; label: string; icon: LucideIcon; shortcut: string }>;
}

const navGroups: NavGroup[] = [
  {
    label: 'Core',
    items: [
      { id: 'mission', label: 'Mission Control', icon: Activity, shortcut: '1' },
      { id: 'agents', label: 'Agents', icon: Bot, shortcut: '2' },
      { id: 'tasks', label: 'Tasks', icon: ClipboardCheck, shortcut: '3' }
    ]
  },
  {
    label: 'Automation',
    items: [
      { id: 'workflows', label: 'Workflows', icon: GitBranch, shortcut: '4' },
      { id: 'collaboration', label: 'Collaborate', icon: Network, shortcut: '5' },
      { id: 'marketplace', label: 'Marketplace', icon: Package, shortcut: '' }
    ]
  },
  {
    label: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', icon: TrendingUp, shortcut: '6' },
      { id: 'costs', label: 'Cost Intel', icon: DollarSign, shortcut: '7' },
      { id: 'usage', label: 'Usage', icon: BarChart3, shortcut: '' }
    ]
  },
  {
    label: 'Admin',
    items: [
      { id: 'team', label: 'Team', icon: Users, shortcut: '8' },
      { id: 'security', label: 'Security', icon: Shield, shortcut: '9' },
      { id: 'integrations', label: 'Integrations', icon: Plug, shortcut: '' },
      { id: 'settings', label: 'Settings', icon: Settings, shortcut: '0' }
    ]
  }
];

const allItems = navGroups.flatMap((g) => g.items);

export function TabNav({ active, onChange }: { active: AppTab; onChange(tab: AppTab): void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.ctrlKey || e.metaKey) {
        const item = allItems.find((t) => t.shortcut === e.key);
        if (item) {
          e.preventDefault();
          onChange(item.id);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  return (
    <nav className="sidebar-nav" aria-label="Command center sections">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true">
          <Activity size={16} />
        </span>
        <span>Command Center</span>
      </div>
      {navGroups.map((group) => (
        <div key={group.label} className="nav-group">
          <span className="nav-group-label">{group.label}</span>
          {group.items.map((item) => (
            <button
              key={item.id}
              className={item.id === active ? 'sidebar-tab active' : 'sidebar-tab'}
              onClick={() => onChange(item.id)}
            >
              <item.icon size={17} aria-hidden="true" />
              {item.label}
              <span className="tab-shortcut">{item.shortcut}</span>
            </button>
          ))}
        </div>
      ))}
      <div className="sidebar-footer">
        <small>Ctrl+1..0 to navigate</small>
      </div>
    </nav>
  );
}
