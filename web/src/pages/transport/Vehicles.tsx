import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Bus, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface Vehicle {
  id: string;
  vehicle_number: string;
  type: 'bus' | 'van' | 'car' | 'minibus';
  capacity: number;
  make_model: string | null;
  year: number | null;
  fuel_type: string | null;
  insurance_expiry: string | null;
  fitness_expiry: string | null;
  permit_expiry: string | null;
  status: 'active' | 'maintenance' | 'retired';
  notes: string | null;
}

export default function Vehicles() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('vehicles.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('vehicles.write'));
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
    vehicle_number: '', type: 'bus' as Vehicle['type'], capacity: 40,
    make_model: '', year: 2024, fuel_type: 'diesel',
    insurance_expiry: '', fitness_expiry: '', permit_expiry: '',
    status: 'active' as Vehicle['status'], notes: '',
  });

  const { data = { items: [] as Vehicle[] }, isLoading } = useQuery<{ items: Vehicle[] }>({
    queryKey: ['vehicles'],
    queryFn: () => api.get('/vehicles'),
  });

  const openEditor = (v?: Vehicle) => {
    if (v) {
      setEditing(v);
      setForm({
        vehicle_number: v.vehicle_number, type: v.type, capacity: v.capacity,
        make_model: v.make_model ?? '', year: v.year ?? 2024, fuel_type: v.fuel_type ?? 'diesel',
        insurance_expiry: v.insurance_expiry ?? '', fitness_expiry: v.fitness_expiry ?? '',
        permit_expiry: v.permit_expiry ?? '',
        status: v.status, notes: v.notes ?? '',
      });
    } else {
      setEditing(null);
      setForm({
        vehicle_number: '', type: 'bus', capacity: 40, make_model: '',
        year: 2024, fuel_type: 'diesel',
        insurance_expiry: '', fitness_expiry: '', permit_expiry: '',
        status: 'active', notes: '',
      });
    }
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        vehicle_number: form.vehicle_number, type: form.type, capacity: Number(form.capacity),
        make_model: form.make_model || null, year: form.year ? Number(form.year) : null,
        fuel_type: form.fuel_type || null,
        insurance_expiry: form.insurance_expiry || null,
        fitness_expiry: form.fitness_expiry || null,
        permit_expiry: form.permit_expiry || null,
        status: form.status, notes: form.notes || null,
      };
      if (editing) {
        await api.patch(`/vehicles/${editing.id}`, payload);
        show('Vehicle updated', 'success');
      } else {
        await api.post('/vehicles', payload);
        show('Vehicle created', 'success');
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (v: Vehicle) => {
    if (!confirm(`Delete vehicle ${v.vehicle_number}?`)) return;
    try {
      await api.delete(`/vehicles/${v.id}`);
      show('Vehicle deleted', 'success');
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Vehicles"
        description={`${data.items.length} vehicle(s)`}
        actions={canWrite && <Button onClick={() => openEditor()}><Plus className="w-4 h-4" /> New Vehicle</Button>}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : data.items.length === 0 ? (
          <EmptyState title="No vehicles" description="Add a vehicle to get started." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Make/Model</th>
                <th className="px-4 py-3">Insurance Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bus className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-mono font-medium">{v.vehicle_number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="info">{v.type}</Badge></td>
                  <td className="px-4 py-3 text-sm">{v.capacity}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{v.make_model ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">{v.insurance_expiry ? formatDate(v.insurance_expiry) : '-'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={v.status === 'active' ? 'success' : v.status === 'maintenance' ? 'warning' : 'default'}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button onClick={() => openEditor(v)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(v)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Vehicle' : 'New Vehicle'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Vehicle Number" required>
              <Input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })} required maxLength={40} />
            </FormField>
            <FormField label="Type" required>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Vehicle['type'] })}>
                <option value="bus">Bus</option>
                <option value="van">Van</option>
                <option value="car">Car</option>
                <option value="minibus">Mini Bus</option>
              </Select>
            </FormField>
            <FormField label="Capacity">
              <Input type="number" min={1} max={200} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Make/Model">
              <Input value={form.make_model} onChange={(e) => setForm({ ...form, make_model: e.target.value })} maxLength={120} />
            </FormField>
            <FormField label="Year">
              <Input type="number" min={1990} max={2100} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </FormField>
            <FormField label="Fuel">
              <Select value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}>
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
                <option value="cng">CNG</option>
                <option value="electric">Electric</option>
              </Select>
            </FormField>
            <FormField label="Insurance Expiry">
              <Input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} />
            </FormField>
            <FormField label="Fitness Expiry">
              <Input type="date" value={form.fitness_expiry} onChange={(e) => setForm({ ...form, fitness_expiry: e.target.value })} />
            </FormField>
            <FormField label="Permit Expiry">
              <Input type="date" value={form.permit_expiry} onChange={(e) => setForm({ ...form, permit_expiry: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vehicle['status'] })}>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </Select>
            </FormField>
          </div>
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
