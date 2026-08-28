import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface Staff {
  id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  joining_date: string | null;
  status: 'active' | 'inactive';
  document_count: number;
}

interface Department {
  name: string;
  count: number;
}

interface FormState {
  employee_code: string;
  full_name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  joining_date: string;
  status: 'active' | 'inactive';
  notes: string;
}

const EMPTY_FORM: FormState = {
  employee_code: '',
  full_name: '',
  department: '',
  designation: '',
  email: '',
  phone: '',
  joining_date: '',
  status: 'active',
  notes: '',
};

export default function StaffList() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('staff.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('staff.delete'));
  const { show, node } = useToasts();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery<{ items: Staff[] }>({
    queryKey: ['staff', q, status, department],
    queryFn: () =>
      api.get(`/staff?q=${encodeURIComponent(q)}&status=${status}&department=${encodeURIComponent(department)}`),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['staff-departments'],
    queryFn: () => api.get('/staff/departments').then((r: { items: Department[] }) => r.items),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      employee_code: s.employee_code,
      full_name: s.full_name,
      department: s.department ?? '',
      designation: s.designation ?? '',
      email: s.email ?? '',
      phone: s.phone ?? '',
      joining_date: s.joining_date ?? '',
      status: s.status,
      notes: '',
    });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        department: form.department || null,
        designation: form.designation || null,
        email: form.email || null,
        phone: form.phone || null,
        joining_date: form.joining_date || null,
        notes: form.notes || null,
      };
      if (editing) {
        await api.patch(`/staff/${editing.id}`, payload);
        show('Staff updated', 'success');
      } else {
        await api.post('/staff', payload);
        show('Staff created', 'success');
      }
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff-departments'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (s: Staff) => {
    if (!confirm(`Archive staff "${s.full_name}"? They will be marked inactive.`)) return;
    try {
      await api.delete(`/staff/${s.id}`);
      show('Staff archived', 'success');
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff-departments'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Staff Directory"
        description={`${data?.items.length ?? 0} staff members`}
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> Add Staff
            </Button>
          )
        }
      />

      {/* Department cards */}
      {departments.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {departments.slice(0, 8).map((d) => (
            <Card key={d.name} className="p-4">
              <div className="text-xs text-slate-500 truncate">{d.name}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{d.count}</div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, code, email, phone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-auto">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No staff found"
            description="Add staff members or adjust your filters."
            action={canWrite && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Staff</Button>}
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Docs</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/staff/${s.id}`} className="text-blue-600 hover:underline font-medium">
                      {s.full_name}
                    </Link>
                    <div className="text-xs text-slate-500">{s.employee_code}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.department ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{s.designation ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {s.email && <div className="text-slate-700">{s.email}</div>}
                    {s.phone && <div className="text-slate-500 text-xs">{s.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(s.joining_date)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{s.document_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/staff/${s.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {canDelete && s.status === 'active' && (
                      <button
                        onClick={() => remove(s)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-700 hover:bg-red-50 ml-1"
                        title="Archive"
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.full_name}` : 'Add Staff Member'}
        size="lg"
      >
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <FormField label="Employee Code" required>
            <Input
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              required
              maxLength={40}
            />
          </FormField>
          <FormField label="Full Name" required>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              maxLength={120}
            />
          </FormField>
          <FormField label="Department">
            <Input
              list="staff-departments"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="e.g. Administration, Accounts"
            />
            <datalist id="staff-departments">
              {departments.map((d) => <option key={d.name} value={d.name} />)}
            </datalist>
          </FormField>
          <FormField label="Designation">
            <Input
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              placeholder="e.g. Office Manager"
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
          <div className="col-span-2">
            <FormField label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </FormField>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Staff'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
