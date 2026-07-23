// @deprecated Per VISION.md §4.4, platform_admin cannot manage staff.
// This component is no longer routed to from PlatformLayout.
// Kept for reference only — do not re-enable without VISION.md amendment.
import { useEffect, useState, useCallback } from 'react';
import { Users, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { platformAdminService, PlatformUser, PlatformUserMembership } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

const ROLES = ['admin', 'manager', 'cashier'] as const;
const PAGE_SIZE = 25;

export function UserManagement() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = { page, page_size: PAGE_SIZE };
      if (filterRole) filters.role = filterRole;
      if (filterActive) filters.is_active = filterActive === 'active';

      const data = await platformAdminService.listUsers(filters);
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      swalConfig.error('Failed to load users');
    }
    setLoading(false);
  }, [page, filterRole, filterActive]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function resetFilters() {
    setFilterRole('');
    setFilterActive('');
    setPage(1);
  }

  async function handleRoleChange(membership: PlatformUserMembership, userId: string, newRole: string) {
    if (membership.role === newRole) return;
    try {
      await platformAdminService.updateUserRole(
        membership.membershipId,
        userId,
        membership.shopId,
        newRole as 'admin' | 'manager' | 'cashier',
      );
      setUsers(users.map(u => {
        if (u.userId !== userId) return u;
        return {
          ...u,
          memberships: u.memberships.map(m =>
            m.membershipId === membership.membershipId ? { ...m, role: newRole } : m
          ),
        };
      }));
      swalConfig.success(`Role updated to ${newRole}`);
    } catch {
      swalConfig.error('Failed to update role');
    }
  }

  async function handleToggleActive(membership: PlatformUserMembership, userId: string) {
    const newActive = !membership.isActive;
    try {
      await platformAdminService.toggleUserActive(
        membership.membershipId,
        userId,
        membership.shopId,
        newActive,
      );
      setUsers(users.map(u => {
        if (u.userId !== userId) return u;
        return {
          ...u,
          memberships: u.memberships.map(m =>
            m.membershipId === membership.membershipId ? { ...m, isActive: newActive } : m
          ),
        };
      }));
      swalConfig.success(newActive ? 'User activated' : 'User deactivated');
    } catch {
      swalConfig.error('Failed to update user status');
    }
  }

  // Client-side search filter (for username/name/email)
  const filteredUsers = searchQuery
    ? users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users size={24} className="text-primary-600" />
        <h1 className="text-2xl font-fraunces font-bold text-secondary-900 dark:text-secondary-100">
          User Management
        </h1>
        <span className="badge badge-accent ml-2">{total} users</span>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              type="text"
              placeholder="Search by name, username, or email…"
              className="input pl-9 w-full"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="select"
            value={filterRole}
            onChange={e => { setFilterRole(e.target.value); setPage(1); }}
          >
            <option value="">All Roles</option>
            {ROLES.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>

          <select
            className="select"
            value={filterActive}
            onChange={e => { setFilterActive(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {(filterRole || filterActive) && (
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-secondary-600 dark:text-secondary-300">
            Loading users…
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-secondary-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">User</th>
                  <th className="table-header-cell">Shop Memberships</th>
                  <th className="table-header-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <UserRow
                    key={user.userId}
                    user={user}
                    onRoleChange={handleRoleChange}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-secondary-600 dark:text-secondary-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row sub-component ──────────────────────────────────────────

interface UserRowProps {
  user: PlatformUser;
  onRoleChange: (membership: PlatformUserMembership, userId: string, newRole: string) => void;
  onToggleActive: (membership: PlatformUserMembership, userId: string) => void;
}

function UserRow({ user, onRoleChange, onToggleActive }: UserRowProps) {
  return (
    <>
      {/* Main user row */}
      <tr className="table-row">
        <td className="table-cell">
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-sm font-bold text-primary-600">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-medium text-secondary-900 dark:text-secondary-100">{user.name}</div>
              <div className="text-xs text-secondary-500">@{user.username} · {user.email}</div>
            </div>
          </div>
        </td>
        <td className="table-cell" colSpan={2}>
          {/* Memberships rendered inline below */}
        </td>
      </tr>
      {/* One sub-row per membership */}
      {user.memberships.map(m => (
        <tr key={m.membershipId} className="table-row bg-secondary-50/50 dark:bg-secondary-900/30">
          <td className="table-cell pl-12 text-sm text-secondary-600 dark:text-secondary-400">
            {m.shopName}
          </td>
          <td className="table-cell">
            <select
              className="select select-sm"
              value={m.role}
              onChange={e => onRoleChange(m, user.userId, e.target.value)}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </td>
          <td className="table-cell">
            <button
              className={`btn btn-sm ${m.isActive ? 'btn-primary' : 'btn-danger'}`}
              onClick={() => onToggleActive(m, user.userId)}
            >
              {m.isActive ? 'Active' : 'Inactive'}
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}
