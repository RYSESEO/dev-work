import { AlertTriangle, Bot, GitBranch, Lock, MessageSquare, Play, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentProfile,
  CollaborationSession,
  CollaborationSnapshot,
  DashboardSnapshot,
  SubTask
} from '../../../shared/domain';
import { commandCenterClient } from '../api/client';
import { useToast } from './ToastProvider';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh: () => void;
}

export function CollaborationView({ snapshot, onRefresh }: Props) {
  const hasLicense = snapshot.license.features.includes('multi_agent_collaboration');
  const [data, setData] = useState<CollaborationSnapshot | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [strategy, setStrategy] = useState<CollaborationSession['strategy']>('parallel');
  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [isCreating, setIsCreating] = useState(false);

  // Sub-task form
  const [subTaskTitle, setSubTaskTitle] = useState('');
  const [subTaskDesc, setSubTaskDesc] = useState('');

  const toast = useToast();
  const didLoad = useRef(false);

  const load = useCallback(async () => {
    try {
      setData(await commandCenterClient.getCollaboration());
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (!didLoad.current) {
      didLoad.current = true;
      void load();
    }
  }, [load]);

  async function handleCreate() {
    if (!sessionTitle.trim()) { toast.error('Title is required'); return; }
    setIsCreating(true);
    try {
      const session = await commandCenterClient.createCollabSession(
        sessionTitle.trim(), sessionDesc.trim(), strategy, null, maxConcurrency
      );
      toast.success('Session created');
      setSessionTitle(''); setSessionDesc('');
      setShowCreateForm(false);
      setSelectedSession(session.id);
      await load();
      onRefresh();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await commandCenterClient.deleteCollabSession(id);
      toast.success('Session deleted');
      if (selectedSession === id) setSelectedSession(null);
      await load();
      onRefresh();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleAddSubTask(sessionId: string) {
    if (!subTaskTitle.trim()) { toast.error('Sub-task title is required'); return; }
    try {
      await commandCenterClient.addCollabSubTask(sessionId, subTaskTitle.trim(), subTaskDesc.trim());
      toast.success('Sub-task added');
      setSubTaskTitle(''); setSubTaskDesc('');
      await load();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleAssignSubTask(sessionId: string, subTaskId: string, agentId: string) {
    try {
      await commandCenterClient.assignCollabSubTask(sessionId, subTaskId, agentId);
      await load();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleExecute(sessionId: string) {
    try {
      await commandCenterClient.executeCollabSession(sessionId);
      toast.success('Execution started');
      await load();
      onRefresh();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleUpdateStatus(sessionId: string, status: CollaborationSession['status']) {
    try {
      await commandCenterClient.updateCollabStatus(sessionId, status);
      await load();
      onRefresh();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!hasLicense) {
    return (
      <main className="app-shell">
        <header className="view-header">
          <span className="section-label">Automation</span>
          <h1>Multi-Agent Collaboration</h1>
          <p>Coordinate multiple agents to work together on complex tasks.</p>
        </header>
        <section className="panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <Lock size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Pro or Team License Required</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            Multi-agent collaboration — including task decomposition, parallel execution,
            shared context, inter-agent messaging, and conflict resolution — is available
            on <strong>Pro</strong> and <strong>Team</strong> plans.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Single-agent workflows, the dashboard, analytics, and all other features
            remain fully available on the Free tier.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => {
              void commandCenterClient.startCheckout('pro', snapshot.currentUser?.email ?? '')
                .then(() => toast.success('Opening Pro checkout in your browser...'))
                .catch((err) => toast.error(`Checkout failed: ${err instanceof Error ? err.message : 'Configure checkout in Settings → Billing.'}`));
            }}>
              Buy Pro License
            </button>
            <button className="btn" onClick={() => {
              const tabEvent = new CustomEvent('navigate-tab', { detail: 'settings' });
              window.dispatchEvent(tabEvent);
            }}>
              Manage in Settings
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-shell">
        <header className="view-header">
          <span className="section-label">Automation</span>
          <h1>Multi-Agent Collaboration</h1>
          <p>Loading...</p>
        </header>
      </main>
    );
  }

  const session = selectedSession ? data.sessions.find((s) => s.id === selectedSession) : null;

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Automation</span>
        <h1>Multi-Agent Collaboration</h1>
        <p>Decompose tasks across agents, run in parallel, share context, and resolve conflicts.</p>
      </header>

      {/* Summary metrics */}
      <section className="metric-strip">
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><Users size={18} /></span>
          <span className="metric-label">Active sessions</span>
          <strong className="metric-value">{data.activeSessions}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><GitBranch size={18} /></span>
          <span className="metric-label">Total completed</span>
          <strong className="metric-value">{data.totalCompleted}</strong>
        </article>
        <article className="metric">
          <span className="metric-icon" aria-hidden="true"><Bot size={18} /></span>
          <span className="metric-label">Sub-tasks</span>
          <strong className="metric-value">{data.completedSubTasks}/{data.totalSubTasks}</strong>
        </article>
      </section>

      <div className="analytics-grid">
        {/* Sessions list */}
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true"><Users size={18} /></span>
            <div>
              <h2>Sessions</h2>
              <p>Collaboration sessions for multi-agent task execution.</p>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus size={14} /> New
            </button>
          </div>

          {showCreateForm && (
            <div style={{ padding: '0 1rem 1rem' }}>
              <div className="form-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <input className="input" placeholder="Session title" value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
                <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value as CollaborationSession['strategy'])}>
                  <option value="parallel">Parallel</option>
                  <option value="pipeline">Pipeline</option>
                  <option value="divide_and_conquer">Divide & Conquer</option>
                </select>
                <input className="input" type="number" min={1} max={10} value={maxConcurrency}
                  onChange={(e) => setMaxConcurrency(parseInt(e.target.value) || 3)} style={{ width: '60px' }}
                  title="Max concurrency" />
              </div>
              <textarea className="input" placeholder="Description (optional)" value={sessionDesc}
                onChange={(e) => setSessionDesc(e.target.value)}
                style={{ width: '100%', marginTop: '0.5rem', minHeight: '60px' }} />
              <button className="btn btn-sm btn-primary" onClick={handleCreate} disabled={isCreating}
                style={{ marginTop: '0.5rem' }}>
                {isCreating ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          )}

          {data.sessions.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: '0 1rem 1rem', margin: 0 }}>
              {data.sessions.map((s) => (
                <li key={s.id} style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: s.id === selectedSession ? '2px solid var(--primary, #6366f1)' : '1px solid var(--border, #e2e8f0)',
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  background: s.id === selectedSession ? 'var(--bg-secondary, #f8fafc)' : undefined
                }} onClick={() => setSelectedSession(s.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{s.title}</strong>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <span className="badge">{s.status}</span>
                      <span className="badge">{s.strategy}</span>
                      {(s.status === 'planning' || s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled') && (
                        <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                          title="Delete"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  <small style={{ color: 'var(--text-secondary)' }}>
                    {s.subTasks.length} sub-tasks · {s.agentAssignments.length} agents · {s.messages.length} messages
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No collaboration sessions. Create one to start coordinating agents.</p>
          )}
        </section>

        {/* Session detail */}
        {session ? (
          <SessionDetail
            session={session}
            agents={snapshot.agents}
            onAddSubTask={handleAddSubTask}
            onAssignSubTask={handleAssignSubTask}
            onExecute={handleExecute}
            onUpdateStatus={handleUpdateStatus}
            subTaskTitle={subTaskTitle}
            subTaskDesc={subTaskDesc}
            onSubTaskTitleChange={setSubTaskTitle}
            onSubTaskDescChange={setSubTaskDesc}
          />
        ) : (
          <section className="panel">
            <div className="panel-heading">
              <span className="panel-icon" aria-hidden="true"><GitBranch size={18} /></span>
              <div>
                <h2>Session Detail</h2>
                <p>Select a session to view sub-tasks, agents, messages, and conflicts.</p>
              </div>
            </div>
            <p className="empty-state">Select a session from the list to see its details.</p>
          </section>
        )}
      </div>
    </main>
  );
}

interface SessionDetailProps {
  session: CollaborationSession;
  agents: AgentProfile[];
  onAddSubTask: (sessionId: string) => Promise<void>;
  onAssignSubTask: (sessionId: string, subTaskId: string, agentId: string) => Promise<void>;
  onExecute: (sessionId: string) => Promise<void>;
  onUpdateStatus: (sessionId: string, status: CollaborationSession['status']) => Promise<void>;
  subTaskTitle: string;
  subTaskDesc: string;
  onSubTaskTitleChange: (v: string) => void;
  onSubTaskDescChange: (v: string) => void;
}

function SessionDetail({
  session, agents, onAddSubTask, onAssignSubTask, onExecute, onUpdateStatus,
  subTaskTitle, subTaskDesc, onSubTaskTitleChange, onSubTaskDescChange
}: SessionDetailProps) {
  const completedCount = session.subTasks.filter((s) => s.status === 'completed').length;
  const totalCount = session.subTasks.length;
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <section className="panel">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true"><GitBranch size={18} /></span>
        <div>
          <h2>{session.title}</h2>
          <p>{session.description || 'No description'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {session.status === 'planning' && (
            <button className="btn btn-sm btn-primary" onClick={() => onExecute(session.id)}>
              <Play size={14} /> Execute
            </button>
          )}
          {session.status === 'running' && (
            <button className="btn btn-sm btn-danger" onClick={() => onUpdateStatus(session.id, 'cancelled')}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div style={{ padding: '0 1rem' }}>
        <div className="performance-bar" style={{ height: '8px' }}>
          <div className="performance-fill" style={{ width: `${pct}%` }} />
        </div>
        <small style={{ color: 'var(--text-secondary)' }}>{completedCount}/{totalCount} sub-tasks complete</small>
      </div>

      {/* Sub-tasks */}
      <div style={{ padding: '1rem' }}>
        <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Sub-Tasks</h3>
        {session.subTasks.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th>Priority</th>
                  <th>Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {session.subTasks.map((st) => (
                  <SubTaskRow key={st.id} subTask={st} agents={agents} sessionId={session.id}
                    onAssign={onAssignSubTask} isPlanning={session.status === 'planning'} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No sub-tasks yet. Add sub-tasks to decompose the work.</p>
        )}

        {/* Add sub-task form */}
        {session.status === 'planning' && (
          <div className="form-row" style={{ gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <input className="input" placeholder="Sub-task title" value={subTaskTitle}
              onChange={(e) => onSubTaskTitleChange(e.target.value)} style={{ flex: 1, minWidth: '120px' }} />
            <input className="input" placeholder="Description" value={subTaskDesc}
              onChange={(e) => onSubTaskDescChange(e.target.value)} style={{ flex: 2, minWidth: '160px' }} />
            <button className="btn btn-sm btn-primary" onClick={() => onAddSubTask(session.id)}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>

      {/* Agent assignments */}
      <div style={{ padding: '0 1rem 1rem' }}>
        <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Assigned Agents</h3>
        {session.agentAssignments.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {session.agentAssignments.map((a) => {
              const agent = agents.find((ag) => ag.id === a.agentId);
              return (
                <div key={a.agentId} style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border, #e2e8f0)',
                  fontSize: '0.8rem'
                }}>
                  <strong>{agent?.name ?? a.agentId}</strong>
                  <br />
                  <span className="badge">{a.role}</span>
                  <span className="badge">{a.status}</span>
                  <small> · {a.subTaskIds.length} tasks</small>
                </div>
              );
            })}
          </div>
        ) : (
          <small style={{ color: 'var(--text-secondary)' }}>Agents are assigned when sub-tasks are assigned.</small>
        )}
      </div>

      {/* Messages */}
      {session.messages.length > 0 && (
        <div style={{ padding: '0 1rem 1rem' }}>
          <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            <MessageSquare size={14} style={{ verticalAlign: 'middle' }} /> Messages ({session.messages.length})
          </h3>
          <div style={{ maxHeight: '200px', overflow: 'auto', fontSize: '0.8rem' }}>
            {session.messages.slice(-10).map((m) => (
              <div key={m.id} style={{
                padding: '0.4rem 0.5rem',
                borderBottom: '1px solid var(--border, #e2e8f0)'
              }}>
                <span className="badge">{m.type}</span>{' '}
                <strong>{m.subject}</strong>
                <br />
                <small style={{ color: 'var(--text-secondary)' }}>{m.body}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {session.conflicts.length > 0 && (
        <div style={{ padding: '0 1rem 1rem' }}>
          <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> Conflicts ({session.conflicts.length})
          </h3>
          {session.conflicts.map((c) => (
            <div key={c.id} style={{
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid var(--warning, #f59e0b)',
              marginBottom: '0.5rem',
              fontSize: '0.8rem'
            }}>
              <span className="badge">{c.type.replace(/_/g, ' ')}</span>{' '}
              {c.description}
              {c.resolution && (
                <div style={{ marginTop: '0.25rem', color: 'var(--success, #22c55e)' }}>
                  Resolved: {c.resolution}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Shared context */}
      {session.sharedContext.length > 0 && (
        <div style={{ padding: '0 1rem 1rem' }}>
          <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Shared Context</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Key</th><th>Value</th><th>Set by</th></tr>
              </thead>
              <tbody>
                {session.sharedContext.map((c) => (
                  <tr key={c.key}>
                    <td><strong>{c.key}</strong></td>
                    <td>{c.value.length > 100 ? c.value.slice(0, 100) + '...' : c.value}</td>
                    <td>{c.setBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function SubTaskRow({ subTask, agents, sessionId, onAssign, isPlanning }: {
  subTask: SubTask;
  agents: AgentProfile[];
  sessionId: string;
  onAssign: (sessionId: string, subTaskId: string, agentId: string) => Promise<void>;
  isPlanning: boolean;
}) {
  const statusColor: Record<string, string> = {
    pending: 'var(--text-secondary)',
    assigned: 'var(--primary, #6366f1)',
    running: 'var(--warning, #f59e0b)',
    completed: 'var(--success, #22c55e)',
    failed: 'var(--error, #ef4444)',
    skipped: 'var(--text-secondary)'
  };

  const assignedAgent = agents.find((a) => a.id === subTask.assignedAgentId);

  return (
    <tr>
      <td>
        <strong>{subTask.title}</strong>
        {subTask.description && <><br /><small style={{ color: 'var(--text-secondary)' }}>{subTask.description}</small></>}
      </td>
      <td>
        <span className="badge" style={{ background: statusColor[subTask.status], color: '#fff' }}>
          {subTask.status}
        </span>
      </td>
      <td>
        {isPlanning ? (
          <select className="input" style={{ fontSize: '0.75rem', padding: '0.2rem' }}
            value={subTask.assignedAgentId ?? ''}
            onChange={(e) => { if (e.target.value) void onAssign(sessionId, subTask.id, e.target.value); }}>
            <option value="">Unassigned</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ) : (
          assignedAgent?.name ?? subTask.assignedAgentId ?? 'Unassigned'
        )}
      </td>
      <td><span className="badge">{subTask.priority}</span></td>
      <td>{subTask.dependsOn.length > 0 ? subTask.dependsOn.length + ' deps' : '—'}</td>
    </tr>
  );
}
