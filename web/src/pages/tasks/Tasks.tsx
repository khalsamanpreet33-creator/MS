import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ListChecks, User, Calendar, AlertCircle, Check, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate, classNames } from '../../lib/format';

interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  created_by_name: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  related_to: string | null;
  related_id: string | null;
  created_at: string;
}

interface UserOpt { id: string; full_name: string; }

const PRIORITY_BADGE: Record<Task['priority'], 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
};
const STATUS_BADGE: Record<Task['status'], 'default' | 'info' | 'success' | 'warning'> = {
  open: 'warning', in_progress: 'info', done: 'success', cancelled: 'default',
};

export default function Tasks() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('tasks.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('tasks.delete'));
  const me = useAuthStore((s) => s.user);
  const { show, node } = useToasts();

  const [filter, setFilter] = useState<'all' | 'mine' | 'open'>('all');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', assignee_id: '',
    priority: 'normal' as Task['priority'], status: 'open' as Task['status'],
    due_date: '',
  });

  const { data, isLoading } = useQuery<{ items: Task[] }>({
    queryKey: ['tasks', filter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter === 'mine') params.set('mine', '1');
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/tasks?${params}`);
    },
  });

  const { data: users = [] } = useQuery<UserOpt[]>({
    queryKey: ['users-options'],
    queryFn: () => api.get('/auth/users').then((r: { items: UserOpt[] }) => r.items),
  });

  const open = (t?: Task) => {
    if (t) {
      setEditingId(t.id);
      setForm({
        title: t.title, description: t.description ?? '',
        assignee_id: t.assignee_id ?? '',
        priority: t.priority, status: t.status,
        due_date: t.due_date ?? '',
      });
    } else {
      setEditingId(null);
      setForm({ title: '', description: '', assignee_id: '', priority: 'normal', status: 'open', due_date: '' });
    }
    setCreateOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        assignee_id: form.assignee_id || null,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
      };
      if (editingId) {
        await api.patch(`/tasks/${editingId}`, payload);
        show('Task updated', 'success');
      } else {
        await api.post('/tasks', payload);
        show('Task created', 'success');
      }
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const toggleStatus = async (t: Task) => {
    const next = t.status === 'done' ? 'open' : 'done';
    try {
      await api.patch(`/tasks/${t.id}`, { status: next });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (t: Task) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    try {
      await api.delete(`/tasks/${t.id}`);
      show('Task deleted', 'success');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const isOverdue = (t: Task) =>
    t.due_date && new Date(t.due_date) < new Date(new Date().toISOString().slice(0, 10)) && t.status !== 'done';

  return (
    <div>
      {node}
      <PageHeader
        title="Tasks & Follow-ups"
        description={`${data?.items.length ?? 0} task(s)`}
        actions={
          canWrite && <Button onClick={() => open()}><Plus className="w-4 h-4" /> New Task</Button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex border border-slate-200 rounded-md">
            {(['all', 'mine', 'open'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={classNames(
                  'px-3 py-1 text-sm border-r last:border-r-0 border-slate-200',
                  filter === f ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {f === 'all' ? 'All' : f === 'mine' ? `My Tasks (${me?.full_name})` : 'Open'}
              </button>
            ))}
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No tasks"
            description="Create a task to track work."
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(t)}
                      className={classNames(
                        'w-5 h-5 rounded border-2 flex items-center justify-center',
                        t.status === 'done'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 hover:border-emerald-500',
                      )}
                    >
                      {t.status === 'done' && <Check className="w-3 h-3" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className={classNames('font-medium text-slate-900', t.status === 'done' && 'line-through opacity-60')}>
                      {t.title}
                    </div>
                    {t.description && <div className="text-xs text-slate-500 line-clamp-1">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {t.assignee_name ?? <span className="text-slate-400">Unassigned</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant={PRIORITY_BADGE[t.priority]}>{t.priority}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={STATUS_BADGE[t.status]}>{t.status.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3 text-sm">
                    {t.due_date ? (
                      <div className={classNames('flex items-center gap-1', isOverdue(t) && 'text-red-600 font-medium')}>
                        {isOverdue(t) && <AlertCircle className="w-3 h-3" />}
                        <Calendar className="w-3 h-3" />
                        {formatDate(t.due_date)}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button onClick={() => open(t)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(t)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={editingId ? 'Edit Task' : 'New Task'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} />
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Assignee">
              <Select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task['priority'] })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task['status'] })}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Due Date">
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}