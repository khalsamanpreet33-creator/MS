import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserCircle, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  license_number: string;
  license_expiry: string | null;
  address: string | null;
  joining_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
}

export default function Drivers() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('drivers.write'));
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState({
    full_name: '', phone: '', license_number: '',
    license_expiry: '', address: '', joining_date: '',
    status: 'active' as Driver['status'], notes: '',
  });

  const { data = { items: [] as Driver[] }, isLoading } = useQuery<{ items: Driver[] }>({
    queryKey: ['drivers'],
    queryFn: () => api.get('/drivers'),
  });

  const openEditor = (d?: Driver) => {
    if (d) {
      setEditing(d);
      setForm({
        full_name: d.full_name, phone: d.phone ?? '', license_number: d.license_number,
        license_expiry: d.license_expiry ?? '', address: d.address ?? '',
        joining_date: d.joining_date ?? '',
        status: d.status, notes: d.notes ?? '',
      });
    } else {
      setEditing(null);
      setForm({
        full_name: '', phone: '', license_number: '',
        license_expiry: '', address: '', joining_date: '',
        status: 'active', notes: '',
      });
    }
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        full_name: form.full_name, phone: form.phone || null,
        license_number: form.license_number,
        license_expiry: form.license_expiry || null,
        address: form.address || null,
        joining_date: form.joining_date || null,
        status: form.status, notes: form.notes || null,
      };
      if (editing) {
        await api.patch(`/drivers/${editing.id}`, payload);
        show('Driver updated', 'success');
      } else {
        await api.post('/drivers', payload);
        show('Driver created', 'success');
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['drivers'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (d: Driver) => {
    if (!confirm(`Delete driver ${d.full_name}?`)) return;
    try {
      await api.delete(`/drivers/${d.id}`);
      show('Driver deleted', 'success');
      qc.invalidateQueries({ queryKey: ['drivers'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Drivers"
        description={`${data.items.length} driver(s)`}
        actions={canWrite && <Button onClick={() => openEditor()}><Plus className="w-4 h-4" /> New Driver</Button>}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : data.items.length === 0 ? (
          <EmptyState title="No drivers" description="Add a driver to get started." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">License</th>
                <th className="px-4 py-3">License Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium">{d.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{d.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-sm font-mono">{d.license_number}</td>
                  <td className="px-4 py-3 text-sm">{d.license_expiry ? formatDate(d.license_expiry) : '-'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={d.status === 'active' ? 'success' : 'default'}>{d.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <>
                        <button onClick={() => openEditor(d)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(d)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Driver' : 'New Driver'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Full Name" required>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} />
            </FormField>
            <FormField label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
            </FormField>
            <FormField label="License Number" required>
              <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} required maxLength={60} />
            </FormField>
            <FormField label="License Expiry">
              <Input type="date" value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} />
            </FormField>
            <FormField label="Joining Date">
              <Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Driver['status'] })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} />
          </FormField>
          <FormField label="Notes">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
