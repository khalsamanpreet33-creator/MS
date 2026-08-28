import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pin, Megaphone, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface Notice {
  id: string;
  title: string;
  body: string;
  category: 'general' | 'academic' | 'event' | 'holiday' | 'urgent' | 'sports' | 'transport';
  audience: 'all' | 'students' | 'parents' | 'staff' | 'teachers';
  pinned: number;
  publish_date: string;
  expire_date: string | null;
  status: 'draft' | 'published' | 'archived';
  author_name?: string | null;
  created_at: string;
}

const CAT_LABEL: Record<Notice['category'], string> = {
  general: 'General', academic: 'Academic', event: 'Event',
  holiday: 'Holiday', urgent: 'Urgent', sports: 'Sports', transport: 'Transport',
};
const CAT_VARIANT: Record<Notice['category'], 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  general: 'default', academic: 'info', event: 'success',
  holiday: 'info', urgent: 'danger', sports: 'success', transport: 'warning',
};

export default function Notices() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('notices.write'));
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState({
    title: '', body: '', category: 'general' as Notice['category'],
    audience: 'all' as Notice['audience'], pinned: false,
    publish_date: new Date().toISOString().slice(0, 10),
    expire_date: '', status: 'published' as Notice['status'],
  });

  const { data = { items: [] as Notice[] }, isLoading } = useQuery<{ items: Notice[] }>({
    queryKey: ['notices'],
    queryFn: () => api.get('/notices'),
  });

  const openEditor = (n?: Notice) => {
    if (n) {
      setEditing(n);
      setForm({
        title: n.title, body: n.body, category: n.category, audience: n.audience,
        pinned: !!n.pinned,
        publish_date: n.publish_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        expire_date: n.expire_date?.slice(0, 10) ?? '',
        status: n.status,
      });
    } else {
      setEditing(null);
      setForm({
        title: '', body: '', category: 'general', audience: 'all', pinned: false,
        publish_date: new Date().toISOString().slice(0, 10),
        expire_date: '', status: 'published',
      });
    }
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        expire_date: form.expire_date || null,
      };
      if (editing) {
        await api.patch(`/notices/${editing.id}`, payload);
        show('Notice updated', 'success');
      } else {
        await api.post('/notices', payload);
        show('Notice published', 'success');
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['notices'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (n: Notice) => {
    if (!confirm(`Delete notice "${n.title}"?`)) return;
    try {
      await api.delete(`/notices/${n.id}`);
      show('Notice deleted', 'success');
      qc.invalidateQueries({ queryKey: ['notices'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Notice Board"
        description={`${data.items.length} notice(s)`}
        actions={canWrite && <Button onClick={() => openEditor()}><Plus className="w-4 h-4" /> New Notice</Button>}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : data.items.length === 0 ? (
          <EmptyState title="No notices" description="Publish your first notice to share with the school." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((n) => (
                <tr key={n.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {n.pinned === 1 && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                      <div>
                        <div className="text-sm font-medium text-slate-900">{n.title}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{n.body}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant={CAT_VARIANT[n.category]}>{CAT_LABEL[n.category]}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="info">{n.audience}</Badge></td>
                  <td className="px-4 py-3 text-sm">{formatDate(n.publish_date)}</td>
                  <td className="px-4 py-3"><Badge variant={n.status === 'published' ? 'success' : 'default'}>{n.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <>
                        <button onClick={() => openEditor(n)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(n)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Notice' : 'New Notice'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
          </FormField>
          <FormField label="Body" required>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} required maxLength={10000} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Notice['category'] })}>
                {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </FormField>
            <FormField label="Audience">
              <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Notice['audience'] })}>
                <option value="all">All</option>
                <option value="students">Students</option>
                <option value="parents">Parents</option>
                <option value="staff">Staff</option>
                <option value="teachers">Teachers</option>
              </Select>
            </FormField>
            <FormField label="Publish Date">
              <Input type="date" value={form.publish_date} onChange={(e) => setForm({ ...form, publish_date: e.target.value })} required />
            </FormField>
            <FormField label="Expire Date" hint="Optional">
              <Input type="date" value={form.expire_date} onChange={(e) => setForm({ ...form, expire_date: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Notice['status'] })}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>
            <FormField label="Pin to top">
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                <span className="text-sm">Show pinned at top</span>
              </label>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit"><Megaphone className="w-4 h-4" /> {editing ? 'Update' : 'Publish'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
