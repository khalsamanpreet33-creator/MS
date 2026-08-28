import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface Teacher {
  user_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  employee_code: string | null;
  qualification: string | null;
  joining_date: string | null;
  status: 'active' | 'inactive';
  subject_count: number;
  class_count: number;
}

interface EditState {
  employee_code: string;
  qualification: string;
  joining_date: string;
  status: 'active' | 'inactive';
  notes: string;
}

export default function TeachersList() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('teachers.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('teachers.delete'));
  const { show, node } = useToasts();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<EditState>({
    employee_code: '',
    qualification: '',
    joining_date: '',
    status: 'active',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<{ items: Teacher[] }>({
    queryKey: ['teachers', q, status],
    queryFn: () =>
      api.get(`/teachers?q=${encodeURIComponent(q)}&status=${status}`),
  });

  const openEdit = (t: Teacher) => {
    setEditing(t);
    setForm({
      employee_code: t.employee_code ?? '',
      qualification: t.qualification ?? '',
      joining_date: t.joining_date ?? '',
      status: t.status,
      notes: '',
    });
    setEditOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        employee_code: form.employee_code || null,
        qualification: form.qualification || null,
        joining_date: form.joining_date || null,
        status: form.status,
        notes: form.notes || null,
      };
      await api.patch(`/teachers/${editing.user_id}`, payload);
      show('Teacher updated', 'success');
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ['teachers'] });
      qc.invalidateQueries({ queryKey: ['teacher', editing.user_id] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (t: Teacher) => {
    if (!confirm(`Deactivate teacher "${t.full_name}"?`)) return;
    try {
      await api.delete(`/teachers/${t.user_id}`);
      show('Teacher deactivated', 'success');
      qc.invalidateQueries({ queryKey: ['teachers'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Teachers Directory"
        description={`${data?.items.length ?? 0} teacher(s)`}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, username, email, employee code..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No teachers found"
            description="Assign users the 'Teacher' role to populate this directory."
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Employee Code</th>
                <th className="px-4 py-3">Qualification</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Workload</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((t) => (
                <tr key={t.user_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/teachers/${t.user_id}`} className="text-blue-600 hover:underline font-medium">
                      {t.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{t.username}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{t.employee_code ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{t.qualification ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {t.email && <div className="text-slate-700">{t.email}</div>}
                    {t.phone && <div className="text-slate-500 text-xs">{t.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(t.joining_date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {t.subject_count} subj · {t.class_count} class{t.class_count === 1 ? '' : 'es'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === 'active' ? 'success' : 'default'}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/teachers/${t.user_id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {canWrite && (
                      <button
                        onClick={() => openEdit(t)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-700 hover:bg-slate-100 ml-1"
                        title="Edit profile"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && t.status === 'active' && (
                      <button
                        onClick={() => deactivate(t)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-700 hover:bg-red-50 ml-1"
                        title="Deactivate"
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

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${editing?.full_name ?? ''}`}>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Employee Code">
            <Input
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              maxLength={40}
              placeholder="e.g. EMP-001"
            />
          </FormField>
          <FormField label="Qualification">
            <Input
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              placeholder="e.g. M.Sc, B.Ed"
              maxLength={160}
            />
          </FormField>
          <FormField label="Joining Date">
            <Input
              type="date"
              value={form.joining_date}
              onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
            />
          </FormField>
          <FormField label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
