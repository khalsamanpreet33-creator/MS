import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Route as RouteIcon, Edit2, MapPin, UserPlus, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatMoney } from '../../lib/format';

interface RouteRow {
  id: string;
  route_code: string;
  name: string;
  vehicle_id: string | null;
  driver_id: string | null;
  morning_pickup_time: string | null;
  evening_drop_time: string | null;
  distance_km: number | null;
  status: 'active' | 'inactive';
  vehicle_number: string | null;
  driver_name: string | null;
  stop_count: number;
  student_count: number;
}

interface StopRow {
  id: string;
  name: string;
  address: string | null;
  stop_order: number;
  pickup_time: string | null;
  drop_time: string | null;
  fare: number;
}

interface AllocationRow {
  id: string;
  stop_id: string;
  student_id: string;
  student_name: string;
  admission_no: string;
  stop_name: string;
}

interface RouteDetail extends RouteRow {
  stops: StopRow[];
  allocations: AllocationRow[];
}

interface Vehicle { id: string; vehicle_number: string }
interface Driver { id: string; full_name: string }
interface Student { id: string; admission_no: string; first_name: string; last_name: string }

export default function Routes() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('transport.write'));
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [form, setForm] = useState({
    route_code: '', name: '', vehicle_id: '', driver_id: '',
    morning_pickup_time: '', evening_drop_time: '', distance_km: 0,
    status: 'active' as RouteRow['status'],
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteDetail | null>(null);

  const [stopOpen, setStopOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<StopRow | null>(null);
  const [stopForm, setStopForm] = useState({
    name: '', address: '', stop_order: 0,
    pickup_time: '', drop_time: '', fare: 0,
  });

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocForm, setAllocForm] = useState({ stop_id: '', student_id: '' });

  const { data = { items: [] as RouteRow[] }, isLoading } = useQuery<{ items: RouteRow[] }>({
    queryKey: ['transport-routes'],
    queryFn: () => api.get('/transport'),
  });
  const { data: vehicles = { items: [] as Vehicle[] } } = useQuery<{ items: Vehicle[] }>({
    queryKey: ['vehicles'], queryFn: () => api.get('/vehicles'),
  });
  const { data: drivers = { items: [] as Driver[] } } = useQuery<{ items: Driver[] }>({
    queryKey: ['drivers'], queryFn: () => api.get('/drivers'),
  });

  const openEditor = (r?: RouteRow) => {
    if (r) {
      setEditing(r);
      setForm({
        route_code: r.route_code, name: r.name,
        vehicle_id: r.vehicle_id ?? '', driver_id: r.driver_id ?? '',
        morning_pickup_time: r.morning_pickup_time ?? '',
        evening_drop_time: r.evening_drop_time ?? '',
        distance_km: r.distance_km ?? 0, status: r.status,
      });
    } else {
      setEditing(null);
      setForm({
        route_code: '', name: '', vehicle_id: '', driver_id: '',
        morning_pickup_time: '', evening_drop_time: '', distance_km: 0, status: 'active',
      });
    }
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        vehicle_id: form.vehicle_id || null,
        driver_id: form.driver_id || null,
        morning_pickup_time: form.morning_pickup_time || null,
        evening_drop_time: form.evening_drop_time || null,
        distance_km: form.distance_km || null,
      };
      if (editing) {
        await api.patch(`/transport/${editing.id}`, payload);
        show('Route updated', 'success');
      } else {
        await api.post('/transport', payload);
        show('Route created', 'success');
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['transport-routes'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (r: RouteRow) => {
    if (!confirm(`Delete route ${r.route_code}? All stops and allocations will be removed.`)) return;
    try {
      await api.delete(`/transport/${r.id}`);
      show('Route deleted', 'success');
      qc.invalidateQueries({ queryKey: ['transport-routes'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openDetail = async (r: RouteRow) => {
    try {
      const d = await api.get<RouteDetail>(`/transport/${r.id}`);
      setActiveRoute(d);
      setDetailOpen(true);
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openStopEditor = (s?: StopRow) => {
    if (s) {
      setEditingStop(s);
      setStopForm({
        name: s.name, address: s.address ?? '', stop_order: s.stop_order,
        pickup_time: s.pickup_time ?? '', drop_time: s.drop_time ?? '', fare: s.fare,
      });
    } else {
      setEditingStop(null);
      setStopForm({ name: '', address: '', stop_order: 0, pickup_time: '', drop_time: '', fare: 0 });
    }
    setStopOpen(true);
  };

  const saveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoute) return;
    try {
      const payload = {
        ...stopForm,
        address: stopForm.address || null,
        pickup_time: stopForm.pickup_time || null,
        drop_time: stopForm.drop_time || null,
      };
      if (editingStop) {
        await api.patch(`/transport/${activeRoute.id}/stops/${editingStop.id}`, payload);
        show('Stop updated', 'success');
      } else {
        await api.post(`/transport/${activeRoute.id}/stops`, payload);
        show('Stop added', 'success');
      }
      setStopOpen(false);
      openDetail(activeRoute);
      qc.invalidateQueries({ queryKey: ['transport-routes'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const removeStop = async (s: StopRow) => {
    if (!activeRoute || !confirm(`Delete stop "${s.name}"?`)) return;
    try {
      await api.delete(`/transport/${activeRoute.id}/stops/${s.id}`);
      show('Stop deleted', 'success');
      openDetail(activeRoute);
      qc.invalidateQueries({ queryKey: ['transport-routes'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openAlloc = () => {
    if (!activeRoute || activeRoute.stops.length === 0) {
      show('Add at least one stop first', 'info');
      return;
    }
    setAllocForm({ stop_id: activeRoute.stops[0].id, student_id: '' });
    setAllocOpen(true);
  };

  const saveAlloc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoute) return;
    try {
      await api.post(`/transport/${activeRoute.id}/allocations`, allocForm);
      show('Student allocated', 'success');
      setAllocOpen(false);
      openDetail(activeRoute);
      qc.invalidateQueries({ queryKey: ['transport-routes'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const cancelAlloc = async (a: AllocationRow) => {
    if (!activeRoute || !confirm(`Cancel allocation for ${a.student_name}?`)) return;
    try {
      await api.delete(`/transport/${activeRoute.id}/allocations/${a.id}`);
      show('Allocation cancelled', 'success');
      openDetail(activeRoute);
      qc.invalidateQueries({ queryKey: ['transport-routes'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Transport Routes"
        description={`${data.items.length} route(s)`}
        actions={canWrite && <Button onClick={() => openEditor()}><Plus className="w-4 h-4" /> New Route</Button>}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : data.items.length === 0 ? (
          <EmptyState title="No routes" description="Create your first transport route." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium">{r.route_code}</td>
                  <td className="px-4 py-3 text-sm">{r.name}</td>
                  <td className="px-4 py-3 text-sm">{r.vehicle_number ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">{r.driver_name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">{r.stop_count}</td>
                  <td className="px-4 py-3 text-sm">{r.student_count}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === 'active' ? 'success' : 'default'}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openDetail(r)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded text-xs">
                      Open
                    </button>
                    {canWrite && (
                      <>
                        <button onClick={() => openEditor(r)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded ml-1">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(r)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
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

      {/* Route editor modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Route' : 'New Route'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Route Code" required>
              <Input value={form.route_code} onChange={(e) => setForm({ ...form, route_code: e.target.value.toUpperCase() })} required maxLength={40} />
            </FormField>
            <FormField label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={160} />
            </FormField>
            <FormField label="Vehicle">
              <Select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
                <option value="">— None —</option>
                {vehicles.items.map((v) => <option key={v.id} value={v.id}>{v.vehicle_number}</option>)}
              </Select>
            </FormField>
            <FormField label="Driver">
              <Select value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
                <option value="">— None —</option>
                {drivers.items.filter((d) => d.full_name).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Morning Pickup">
              <Input type="time" value={form.morning_pickup_time} onChange={(e) => setForm({ ...form, morning_pickup_time: e.target.value })} />
            </FormField>
            <FormField label="Evening Drop">
              <Input type="time" value={form.evening_drop_time} onChange={(e) => setForm({ ...form, evening_drop_time: e.target.value })} />
            </FormField>
            <FormField label="Distance (km)">
              <Input type="number" step="0.1" min={0} value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RouteRow['status'] })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`${activeRoute?.route_code} — ${activeRoute?.name}`} size="xl">
        {activeRoute && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div><div className="text-slate-500 text-xs">Vehicle</div><div className="font-medium">{activeRoute.vehicle_number ?? '—'}</div></div>
              <div><div className="text-slate-500 text-xs">Driver</div><div className="font-medium">{activeRoute.driver_name ?? '—'}</div></div>
              <div><div className="text-slate-500 text-xs">Pickup / Drop</div><div className="font-medium">{activeRoute.morning_pickup_time ?? '—'} / {activeRoute.evening_drop_time ?? '—'}</div></div>
              <div><div className="text-slate-500 text-xs">Distance</div><div className="font-medium">{activeRoute.distance_km ?? '—'} km</div></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-900">Stops ({activeRoute.stops.length})</h3>
                {canWrite && <Button size="sm" onClick={() => openStopEditor()}><Plus className="w-3.5 h-3.5" /> Add Stop</Button>}
              </div>
              {activeRoute.stops.length === 0 ? (
                <EmptyState title="No stops" description="Add stops along this route." />
              ) : (
                <Table>
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Pickup</th>
                      <th className="px-3 py-2">Drop</th>
                      <th className="px-3 py-2">Fare</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRoute.stops.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-sm">{s.stop_order}</td>
                        <td className="px-3 py-2 text-sm font-medium"><MapPin className="w-3.5 h-3.5 inline mr-1" />{s.name}</td>
                        <td className="px-3 py-2 text-sm">{s.pickup_time ?? '—'}</td>
                        <td className="px-3 py-2 text-sm">{s.drop_time ?? '—'}</td>
                        <td className="px-3 py-2 text-sm">{formatMoney(s.fare)}</td>
                        <td className="px-3 py-2 text-right">
                          {canWrite && (
                            <>
                              <button onClick={() => openStopEditor(s)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removeStop(s)} className="text-red-600 hover:bg-red-50 p-1 rounded ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-900">Allocations ({activeRoute.allocations.length})</h3>
                {canWrite && activeRoute.stops.length > 0 && <Button size="sm" onClick={openAlloc}><UserPlus className="w-3.5 h-3.5" /> Allocate</Button>}
              </div>
              {activeRoute.allocations.length === 0 ? (
                <EmptyState title="No allocations" description="Allocate students to stops." />
              ) : (
                <Table>
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-3 py-2">Adm No</th>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Stop</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRoute.allocations.map((a) => (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-sm font-mono">{a.admission_no}</td>
                        <td className="px-3 py-2 text-sm font-medium">{a.student_name}</td>
                        <td className="px-3 py-2 text-sm">{a.stop_name}</td>
                        <td className="px-3 py-2 text-right">
                          {canWrite && (
                            <button onClick={() => cancelAlloc(a)} className="text-red-600 hover:bg-red-50 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Stop editor modal */}
      <Modal open={stopOpen} onClose={() => setStopOpen(false)} title={editingStop ? 'Edit Stop' : 'Add Stop'}>
        <form onSubmit={saveStop} className="space-y-3">
          <FormField label="Name" required>
            <Input value={stopForm.name} onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })} required maxLength={160} />
          </FormField>
          <FormField label="Address">
            <Input value={stopForm.address} onChange={(e) => setStopForm({ ...stopForm, address: e.target.value })} maxLength={500} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Stop Order">
              <Input type="number" min={0} value={stopForm.stop_order} onChange={(e) => setStopForm({ ...stopForm, stop_order: Number(e.target.value) })} />
            </FormField>
            <FormField label="Pickup">
              <Input type="time" value={stopForm.pickup_time} onChange={(e) => setStopForm({ ...stopForm, pickup_time: e.target.value })} />
            </FormField>
            <FormField label="Drop">
              <Input type="time" value={stopForm.drop_time} onChange={(e) => setStopForm({ ...stopForm, drop_time: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Fare">
            <Input type="number" step="0.01" min={0} value={stopForm.fare} onChange={(e) => setStopForm({ ...stopForm, fare: Number(e.target.value) })} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setStopOpen(false)}>Cancel</Button>
            <Button type="submit">{editingStop ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* Allocation modal */}
      <Modal open={allocOpen} onClose={() => setAllocOpen(false)} title="Allocate Student">
        <form onSubmit={saveAlloc} className="space-y-3">
          <FormField label="Stop" required>
            <Select value={allocForm.stop_id} onChange={(e) => setAllocForm({ ...allocForm, stop_id: e.target.value })} required>
              {activeRoute?.stops.map((s) => <option key={s.id} value={s.id}>{s.stop_order}. {s.name}</option>)}
            </Select>
          </FormField>
          <StudentPicker value={allocForm.student_id} onChange={(v) => setAllocForm({ ...allocForm, student_id: v })} />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setAllocOpen(false)}>Cancel</Button>
            <Button type="submit">Allocate</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StudentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState('');
  const { data = { items: [] as Student[] } } = useQuery<{ items: Student[] }>({
    queryKey: ['students-search', q],
    queryFn: () => api.get(`/students?q=${encodeURIComponent(q)}&limit=20`),
    enabled: true,
  });
  return (
    <FormField label="Student" required>
      <div className="space-y-1">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or admission no..." />
        <Select value={value} onChange={(e) => onChange(e.target.value)} required size={Math.max(3, Math.min(data.items.length + 1, 8))}>
          <option value="">Select student...</option>
          {data.items.map((s) => (
            <option key={s.id} value={s.id}>{s.admission_no} — {s.first_name} {s.last_name}</option>
          ))}
        </Select>
      </div>
    </FormField>
  );
}
