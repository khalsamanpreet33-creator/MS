import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X, Trash2, Calendar, Send, ClipboardList } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface LeaveType {
  id: string;
  code: string;
  name: string;
  days_per_year: number;
  color: string;
  status: 'active' | 'inactive';
}

interface Balance {
  leave_type_id: string;
  code: string;
  name: string;
  color: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  available: number;
}

interface LeaveApp {
  id: string;
  user_id: string;
  user_name: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name: string;
  leave_type_color: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver_name: string | null;
  decision_at: string | null;
  decision_notes: string | null;
  created_at: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'public' | 'school' | 'optional';
}

const STATUS_BADGE: Record<LeaveApp['status'], 'warning' | 'success' | 'danger' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
};

export default function HR() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canApprove = useAuthStore((s) => s.hasPerm('hr.approve'));
  const canWrite = useAuthStore((s) => s.hasPerm('hr.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('hr.delete'));
  const canApply = useAuthStore((s) => s.hasPerm('leave.apply'));
  const { show, node } = useToasts();

  const year = new Date().getFullYear();
  const [tab, setTab] = useState<'applications' | 'holidays'>('applications');
  const [filter, setFilter] = useState('');

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
  const [applying, setApplying] = useState(false);

  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', type: 'public' as Holiday['type'] });

  const { data: types = [] } = useQuery<LeaveType[]>({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/hr/leave-types').then((r: { items: LeaveType[] }) => r.items),
  });

  const { data: balances } = useQuery<{ items: Balance[]; year: number }>({
    queryKey: ['leave-balances', year],
    queryFn: () => api.get(`/hr/balances?year=${year}`),
  });

  const { data: apps, isLoading: appsLoading } = useQuery<{ items: LeaveApp[] }>({
    queryKey: ['leave-applications', filter],
    queryFn: () => api.get(`/hr/applications?status=${filter}`),
  });

  const { data: holidays, isLoading: holLoading } = useQuery<{ items: Holiday[] }>({
    queryKey: ['holidays', year],
    queryFn: () => api.get(`/hr/holidays?year=${year}`),
    enabled: tab === 'holidays',
  });

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    try {
      await api.post('/hr/applications', {
        leave_type_id: applyForm.leave_type_id,
        from_date: applyForm.from_date,
        to_date: applyForm.to_date,
        reason: applyForm.reason || null,
      });
      show('Leave application submitted', 'success');
      setApplyOpen(false);
      setApplyForm({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['leave-applications'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setApplying(false);
    }
  };

  const decide = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    const labels = { approve: 'Approve', reject: 'Reject', cancel: 'Cancel' };
    if (action === 'reject') {
      const notes = prompt('Reason for rejection (optional):') ?? '';
      try {
        await api.patch(`/hr/applications/${id}/reject`, { notes });
        show('Application rejected', 'success');
      } catch (e) { show((e as ApiError).message, 'error'); return; }
    } else if (action === 'approve') {
      try {
        await api.patch(`/hr/applications/${id}/approve`, {});
        show('Application approved', 'success');
      } catch (e) { show((e as ApiError).message, 'error'); return; }
    } else {
      if (!confirm('Cancel your application?')) return;
      try {
        await api.patch(`/hr/applications/${id}/cancel`, {});
        show('Application cancelled', 'success');
      } catch (e) { show((e as ApiError).message, 'error'); return; }
    }
    qc.invalidateQueries({ queryKey: ['leave-applications'] });
    qc.invalidateQueries({ queryKey: ['leave-balances'] });
  };

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/hr/holidays', holidayForm);
      show('Holiday added', 'success');
      setHolidayOpen(false);
      setHolidayForm({ date: '', name: '', type: 'public' });
      qc.invalidateQueries({ queryKey: ['holidays'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const removeHoliday = async (id: string, name: string) => {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    try {
      await api.delete(`/hr/holidays/${id}`);
      show('Holiday removed', 'success');
      qc.invalidateQueries({ queryKey: ['holidays'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="HR & Leave"
        description={`Year ${year}`}
        actions={
          <div className="flex gap-2">
            {canApply && (
              <Button onClick={() => setApplyOpen(true)}>
                <Plus className="w-4 h-4" /> Apply for Leave
              </Button>
            )}
          </div>
        }
      />

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {balances?.items.map((b) => (
          <Card key={b.leave_type_id} className="p-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: b.color }} />
              <span className="text-xs text-slate-500">{b.name}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-slate-900">{b.available}</span>
              <span className="text-xs text-slate-500">/ {b.total_days} days</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Used {b.used_days} · Pending {b.pending_days}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab('applications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1 ${
            tab === 'applications' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Leave Applications
        </button>
        <button
          onClick={() => setTab('holidays')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1 ${
            tab === 'holidays' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" /> Holidays
        </button>
      </div>

      {tab === 'applications' && (
        <Card>
          <div className="p-4 border-b border-slate-100">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          {appsLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (apps?.items.length ?? 0) === 0 ? (
            <EmptyState title="No applications" description="No leave applications to show." />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Approver</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {apps!.items.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{a.user_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="default">
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: a.leave_type_color }} />
                        {a.leave_type_code}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(a.from_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(a.to_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{a.days}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{a.reason ?? '—'}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS_BADGE[a.status]}>{a.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{a.approver_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {a.status === 'pending' && (
                        <>
                          {canApprove && (
                            <>
                              <button
                                onClick={() => decide(a.id, 'approve')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-emerald-700 hover:bg-emerald-50"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => decide(a.id, 'reject')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-700 hover:bg-red-50 ml-1"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {a.user_id === user?.id && (
                            <button
                              onClick={() => decide(a.id, 'cancel')}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-600 hover:bg-slate-100 ml-1"
                              title="Cancel"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'holidays' && (
        <Card>
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div className="text-sm text-slate-600">{holidays?.items.length ?? 0} holiday(s) in {year}</div>
            {canWrite && (
              <Button size="sm" onClick={() => setHolidayOpen(true)}>
                <Plus className="w-4 h-4" /> Add Holiday
              </Button>
            )}
          </div>
          {holLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (holidays?.items.length ?? 0) === 0 ? (
            <EmptyState title="No holidays" description="No holidays configured for this year." />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {holidays!.items.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(h.date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{h.name}</td>
                    <td className="px-4 py-3"><Badge variant="info">{h.type}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {canDelete && (
                        <button
                          onClick={() => removeHoliday(h.id, h.name)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Apply modal */}
      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for Leave">
        <form onSubmit={apply} className="space-y-3">
          <FormField label="Leave Type" required>
            <Select
              value={applyForm.leave_type_id}
              onChange={(e) => setApplyForm({ ...applyForm, leave_type_id: e.target.value })}
              required
            >
              <option value="">Select type...</option>
              {types.filter((t) => t.status === 'active').map((t) => (
                <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="From Date" required>
              <Input
                type="date"
                value={applyForm.from_date}
                onChange={(e) => setApplyForm({ ...applyForm, from_date: e.target.value })}
                required
              />
            </FormField>
            <FormField label="To Date" required>
              <Input
                type="date"
                value={applyForm.to_date}
                onChange={(e) => setApplyForm({ ...applyForm, to_date: e.target.value })}
                required
              />
            </FormField>
          </div>
          <FormField label="Reason">
            <textarea
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional context..."
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={applying}>
              <Send className="w-4 h-4" />
              {applying ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Holiday modal */}
      <Modal open={holidayOpen} onClose={() => setHolidayOpen(false)} title="Add Holiday">
        <form onSubmit={addHoliday} className="space-y-3">
          <FormField label="Date" required>
            <Input
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              required
              maxLength={120}
            />
          </FormField>
          <FormField label="Type">
            <Select
              value={holidayForm.type}
              onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as Holiday['type'] })}
            >
              <option value="public">Public Holiday</option>
              <option value="school">School Holiday</option>
              <option value="optional">Optional Holiday</option>
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setHolidayOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Holiday</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
