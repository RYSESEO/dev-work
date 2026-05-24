import { Shield, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot, UserRole } from '../../../shared/domain';
import { commandCenterClient } from '../api/client';

interface Props {
  snapshot: DashboardSnapshot;
  onRefresh(): Promise<void>;
}

export function TeamView({ snapshot, onRefresh }: Props) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('operator');

  async function handleAddUser(): Promise<void> {
    if (!name.trim() || !email.trim()) return;
    await commandCenterClient.createUser(name.trim(), email.trim(), role);
    setName('');
    setEmail('');
    setRole('operator');
    setShowAddUser(false);
    await onRefresh();
  }

  async function handleRoleChange(userId: string, newRole: UserRole): Promise<void> {
    await commandCenterClient.updateUserRole(userId, newRole);
    await onRefresh();
  }

  const roleColors: Record<UserRole, string> = {
    admin: 'level-chip level-error',
    operator: 'level-chip level-warning',
    viewer: 'level-chip level-info'
  };

  return (
    <main className="app-shell">
      <header className="view-header">
        <span className="section-label">Team</span>
        <h1>Team & Access</h1>
        <p>Manage team members, roles, and permissions for your command center.</p>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Users size={18} /></span>
          <div>
            <h2>Team members</h2>
            <p>{snapshot.users.length} member{snapshot.users.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="primary-button" onClick={() => setShowAddUser(!showAddUser)} style={{ marginLeft: 'auto' }}>
            <UserPlus size={15} /> Add member
          </button>
        </div>

        {showAddUser && (
          <div className="form-row">
            <input
              className="input"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="primary-button" onClick={() => void handleAddUser()}>Add</button>
          </div>
        )}

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td><span className={roleColors[user.role]}>{user.role}</span></td>
                  <td>{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <select
                      className="input compact-input"
                      value={user.role}
                      onChange={(e) => void handleRoleChange(user.id, e.target.value as UserRole)}
                    >
                      <option value="admin">Admin</option>
                      <option value="operator">Operator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <span className="panel-icon" aria-hidden="true"><Shield size={18} /></span>
          <div>
            <h2>Role permissions</h2>
            <p>What each role can do in the command center.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Admin</th>
                <th>Operator</th>
                <th>Viewer</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['View dashboard', true, true, true],
                ['Create missions & tasks', true, true, false],
                ['Launch runs', true, true, false],
                ['Approve / reject requests', true, true, false],
                ['Manage runners & plugins', true, false, false],
                ['Manage team members', true, false, false],
                ['Configure sandbox & security', true, false, false],
                ['Create & manage workflows', true, true, false],
                ['View analytics', true, true, true]
              ].map(([perm, admin, operator, viewer]) => (
                <tr key={perm as string}>
                  <td>{perm as string}</td>
                  <td>{admin ? 'Yes' : 'No'}</td>
                  <td>{operator ? 'Yes' : 'No'}</td>
                  <td>{viewer ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
