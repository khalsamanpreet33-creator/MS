import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, MessageSquare, Edit2, Check, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate, classNames } from '../../lib/format';

interface Complaint {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  raised_by_name: string;
  assigned_to_name: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface Comment {
  id: string;
  author_name: string;
  message: string;
  is_internal: number;
  created_at: string;
}

interface UserOpt { id: string; full_name: string; }

const PRIORITY_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
};
const STATUS_BADGE: Record<string, 'warning' | 'info' | 'success' | 'default' | 'danger'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default', rejected: 'danger',
};

export default function Complaints() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('complaints.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('complaints.delete'));
  const { show, node } = useToasts();

  const [scope, setScope] = useState<'all' | 'mine' | 'assigned'>('all');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', category: 'general',
    priority: 'normal', assigned_to: '',
  });
  const [commentMsg, setCommentMsg] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data, isLoading } = useQuery<{ items: Complaint[] }>({
    queryKey: ['complaints', scope, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (scope === 'mine') params.set('mine', '1');
      if (scope === 'assigned') params.set('assigned', '1');
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/complaints?${params}`);
    },
  });

  const { data: users = [] } = useQuery<UserOpt[]>({
    queryKey: ['users-options'],
    queryFn: () => api.get('/auth/users').then((r: { items: UserOpt[] }) => r.items),
  });

  const { data: detail } = useQuery<Complaint & { comments: Comment[] }>({
    queryKey: ['complaint-detail', detailId],
    queryFn: () => api.get(`/complaints/${detailId}`),
    enabled: !!detailId,
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', description: '', category: 'general', priority: 'normal', assigned_to: '' });
    setCreateOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title, description: form.description,
        category: form.category, priority: form.priority,
        assigned_to: form.assigned_to || null,
      };
      if (editingId) {
        await api.patch(`/complaints/${editingId}`, payload);
        show('Complaint updated', 'success');
      } else {
        await api.post('/complaints', payload);
        show('Complaint created', 'success');
      }
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['complaints'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const setStatus = async (id: string, status: string, resolution?: string) => {
    try {
      await api.patch(`/complaints/${id}`, { status, resolution: resolution ?? null });
      show(`Marked ${status}`, 'success');
      qc.invalidateQueries({ queryKey: ['complaints'] });
      qc.invalidateQueries({ queryKey: ['complaint-detail', id] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (c: Complaint) => {
    if (!confirm(`Delete ticket ${c.ticket_number}?`)) return;
    try {
      await api.delete(`/complaints/${c.id}`);
      show('Complaint deleted', 'success');
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ['complaints'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailId || !commentMsg) return;
    try {
      await api.post(`/complaints/${detailId}/comments`, {
        message: commentMsg, is_internal: isInternal,
      });
      setCommentMsg('');
      setIsInternal(false);
      qc.invalidateQueries({ queryKey: ['complaint-detail', detailId] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Complaints"
        description={`${data?.items.length ?? 0} ticket(s)`}
        actions={canWrite && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Raise Complaint</Button>}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex border border-slate-200 rounded-md">
            {(['all', 'mine', 'assigned'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={classNames(
                  'px-3 py-1 text-sm border-r last:border-r-0 border-slate-200 capitalize',
                  scope === s ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : (data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No complaints"
                description="All clear. Raise a complaint to track issues."
              />
            ) : (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((c) => (
                    <tr
                      key={c.id}
                      className={classNames('border-t border-slate-100 hover:bg-slate-50 cursor-pointer',
                        detailId === c.id && 'bg-blue-50')}
                      onClick={() => setDetailId(c.id)}
                    >
                      <td className="px-4 py-3 text-sm font-mono">{c.ticket_number}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">{c.title}</div>
                        <div className="text-xs text-slate-500">by {c.raised_by_name}</div>
                      </td>
                      <td className="px-4 py-3"><Badge variant="info">{c.category}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={PRIORITY_BADGE[c.priority]}>{c.priority}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={STATUS_BADGE[c.status]}>{c.status.replace('_', ' ')}</Badge></td>
                      <td className="px-4 py-3 text-sm text-slate-700">{c.assigned_to_name ?? <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canDelete && (
                          <button onClick={() => remove(c)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
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
        </div>

        <div className="lg:col-span-1">
          {detail ? (
            <Card className="p-5 sticky top-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-xs font-mono text-slate-500">{detail.ticket_number}</div>
                  <div className="font-semibold text-slate-900">{detail.title}</div>
                </div>
                <Badge variant={STATUS_BADGE[detail.status]}>{detail.status.replace('_', ' ')}</Badge>
              </div>
              <div className="text-xs text-slate-500 mb-2">
                {detail.category} · {detail.priority} · {formatDate(detail.created_at)}
              </div>
              <div className="bg-slate-50 rounded p-3 text-sm text-slate-700 whitespace-pre-wrap mb-3">
                {detail.description}
              </div>
              {detail.assigned_to_name && (
                <div className="text-xs text-slate-600 mb-3">
                  Assigned to: <span className="font-medium">{detail.assigned_to_name}</span>
                </div>
              )}
              {canWrite && (
                <div className="flex flex-wrap gap-1 mb-4 pb-4 border-b border-slate-100">
                  {detail.status === 'open' && (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(detail.id, 'in_progress')}>In Progress</Button>
                  )}
                  {detail.status !== 'resolved' && detail.status !== 'closed' && detail.status !== 'rejected' && (
                    <Button size="sm" onClick={() => setStatus(detail.id, 'resolved', 'Resolved')}>
                      <Check className="w-3 h-3" /> Resolve
                    </Button>
                  )}
                  {detail.status !== 'closed' && (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(detail.id, 'closed')}>Close</Button>
                  )}
                  {detail.status === 'open' && (
                    <Button size="sm" variant="danger" onClick={() => setStatus(detail.id, 'rejected')}>
                      <X className="w-3 h-3" /> Reject
                    </Button>
                  )}
                </div>
              )}
              <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Comments ({detail.comments.length})
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2 mb-3">
                {detail.comments.map((cm) => (
                  <div key={cm.id} className={classNames(
                    'rounded p-2 text-sm',
                    cm.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50',
                  )}>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="font-medium text-slate-700">{cm.author_name}</span>
                      {cm.is_internal && <Badge variant="warning">internal</Badge>}
                      <span>· {formatDate(cm.created_at)}</span>
                    </div>
                    <div className="text-slate-700 mt-1">{cm.message}</div>
                  </div>
                ))}
              </div>
              {canWrite && (
                <form onSubmit={addComment} className="space-y-2">
                  <Textarea
                    value={commentMsg}
                    onChange={(e) => setCommentMsg(e.target.value)}
                    rows={2}
                    placeholder="Add a comment..."
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                      Internal note
                    </label>
                    <Button size="sm" type="submit" disabled={!commentMsg}>Comment</Button>
                  </div>
                </form>
              )}
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-400 text-sm">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Select a complaint to view details and add comments.
            </Card>
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Raise Complaint" size="lg">
        <form onSubmit={save} className="space-y-3">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="transport">Transport</option>
                <option value="facility">Facility</option>
                <option value="staff">Staff</option>
                <option value="safety">Safety</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </FormField>
            <FormField label="Assign To">
              <Select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Description" required>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={4} maxLength={4000} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Raise</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}