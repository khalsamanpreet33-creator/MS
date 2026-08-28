import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Package, Edit2, UserCheck, RotateCcw, TrendingDown } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate, formatMoney } from '../../lib/format';

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  purchase_date: string;
  purchase_cost: number;
  current_value: number;
  location: string | null;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  status: 'active' | 'maintenance' | 'retired' | 'disposed' | 'lost';
  depreciation_rate: number | null;
  notes: string | null;
}

interface Category { id: string; name: string; depreciation_rate: number }
interface Vendor { id: string; name: string }

export default function Assets() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('assets.write'));
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState({
    asset_code: '', name: '', description: '', category_id: '', vendor_id: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_cost: 0, location: '', depreciation_rate: 10,
    status: 'active' as Asset['status'], notes: '',
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<Asset | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    assigned_to_type: 'staff' as 'student' | 'staff' | 'department' | 'room',
    assigned_to_id: '', assigned_to_name: '', notes: '',
  });

  const { data = { items: [] as Asset[] }, isLoading } = useQuery<{ items: Asset[] }>({
    queryKey: ['assets'], queryFn: () => api.get('/assets'),
  });
  const { data: cats = { items: [] as Category[] } } = useQuery<{ items: Category[] }>({
    queryKey: ['asset-cats'], queryFn: () => api.get('/assets/categories'),
  });
  const { data: vendors = { items: [] as Vendor[] } } = useQuery<{ items: Vendor[] }>({
    queryKey: ['asset-vendors'], queryFn: () => api.get('/inventory/vendors'),
  });

  const openEditor = (a?: Asset) => {
    if (a) {
      setEditing(a);
      setForm({
        asset_code: a.asset_code, name: a.name, description: a.description ?? '',
        category_id: a.category_id ?? '', vendor_id: a.vendor_id ?? '',
        purchase_date: a.purchase_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        purchase_cost: a.purchase_cost, location: a.location ?? '',
        depreciation_rate: a.depreciation_rate ?? 10,
        status: a.status, notes: a.notes ?? '',
      });
    } else {
      setEditing(null);
      setForm({
        asset_code: '', name: '', description: '', category_id: '', vendor_id: '',
        purchase_date: new Date().toISOString().slice(0, 10),
        purchase_cost: 0, location: '', depreciation_rate: 10, status: 'active', notes: '',
      });
    }
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        asset_code: form.asset_code, name: form.name,
        description: form.description || null,
        category_id: form.category_id || null,
        vendor_id: form.vendor_id || null,
        purchase_date: form.purchase_date,
        purchase_cost: Number(form.purchase_cost),
        location: form.location || null,
        depreciation_rate: Number(form.depreciation_rate),
        status: form.status, notes: form.notes || null,
      };
      if (editing) {
        await api.patch(`/assets/${editing.id}`, payload);
        show('Asset updated', 'success');
      } else {
        await api.post('/assets', payload);
        show('Asset added', 'success');
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (a: Asset) => {
    if (!confirm(`Delete asset ${a.asset_code}?`)) return;
    try {
      await api.delete(`/assets/${a.id}`);
      show('Asset deleted', 'success');
      qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openDetail = async (a: Asset) => {
    try {
      const d = await api.get<Asset & { history: any[]; depreciation: any[] }>(`/assets/${a.id}`);
      setActive(d);
      setDetailOpen(true);
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openAssign = () => {
    setAssignForm({ assigned_to_type: 'staff', assigned_to_id: '', assigned_to_name: '', notes: '' });
    setAssignOpen(true);
  };

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    try {
      await api.post(`/assets/${active.id}/assign`, assignForm);
      show('Asset assigned', 'success');
      setAssignOpen(false);
      const d = await api.get<Asset>(`/assets/${active.id}`);
      setActive(d);
      qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const returnAsset = async (a: Asset) => {
    try {
      await api.post(`/assets/${a.id}/return`, { condition: 'good' });
      show('Asset returned', 'success');
      if (active) {
        const d = await api.get<Asset>(`/assets/${a.id}`);
        setActive(d);
      }
      qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const depreciate = async () => {
    if (!active) return;
    const year = prompt('Period year (YYYY):', String(new Date().getFullYear()));
    if (!year) return;
    try {
      const r = await api.post<{ amount: number; new_value: number }>(`/assets/${active.id}/depreciate`, { period_year: Number(year) });
      show(`Depreciation: ${formatMoney(r.amount)} → ${formatMoney(r.new_value)}`, 'success');
      const d = await api.get<Asset>(`/assets/${active.id}`);
      setActive(d);
      qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const statusVariant = (s: Asset['status']): 'success' | 'warning' | 'default' | 'danger' =>
    s === 'active' ? 'success' : s === 'maintenance' ? 'warning' : s === 'disposed' || s === 'lost' ? 'danger' : 'default';

  return (
    <div>
      {node}
      <PageHeader
        title="Asset Register"
        description={`${data.items.length} asset(s) · ${formatMoney(data.items.reduce((s, a) => s + a.current_value, 0))} book value`}
        actions={canWrite && <Button onClick={() => openEditor()}><Plus className="w-4 h-4" /> New Asset</Button>}
      />

      <Card>
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> :
          data.items.length === 0 ? <EmptyState title="No assets" description="Add an asset to start tracking." /> :
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Book Value</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono">{a.asset_code}</td>
                  <td className="px-4 py-3 text-sm font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-sm">{a.category_name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">{a.location ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">{formatMoney(a.purchase_cost)}</td>
                  <td className="px-4 py-3 text-sm">{formatMoney(a.current_value)}</td>
                  <td className="px-4 py-3 text-sm">
                    {a.assigned_to_name ? (
                      <div>
                        <div>{a.assigned_to_name}</div>
                        <div className="text-xs text-slate-500">{a.assigned_to_type}</div>
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3"><Badge variant={statusVariant(a.status)}>{a.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openDetail(a)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded text-xs">Open</button>
                    {canWrite && (
                      <>
                        <button onClick={() => openEditor(a)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded ml-1"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => remove(a)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        }
      </Card>

      {/* Asset modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Asset' : 'New Asset'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Asset Code" required><Input value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} required maxLength={40} /></FormField>
            <FormField label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} /></FormField>
            <FormField label="Category">
              <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">— None —</option>
                {cats.items.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.depreciation_rate}%)</option>)}
              </Select>
            </FormField>
            <FormField label="Vendor">
              <Select value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
                <option value="">— None —</option>
                {vendors.items.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Purchase Date" required><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} required /></FormField>
            <FormField label="Purchase Cost"><Input type="number" min={0} step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: Number(e.target.value) })} /></FormField>
            <FormField label="Depreciation Rate (%)"><Input type="number" min={0} max={100} step="0.01" value={form.depreciation_rate} onChange={(e) => setForm({ ...form, depreciation_rate: Number(e.target.value) })} /></FormField>
            <FormField label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={100} /></FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Asset['status'] })}>
                <option value="active">Active</option><option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option><option value="disposed">Disposed</option><option value="lost">Lost</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={2} /></FormField>
          <FormField label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} rows={2} /></FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`${active?.asset_code} — ${active?.name}`} size="xl">
        {active && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div><div className="text-slate-500 text-xs">Cost</div><div className="font-medium">{formatMoney(active.purchase_cost)}</div></div>
              <div><div className="text-slate-500 text-xs">Book Value</div><div className="font-medium">{formatMoney(active.current_value)}</div></div>
              <div><div className="text-slate-500 text-xs">Depreciation</div><div className="font-medium">{active.depreciation_rate ?? 0}% / yr</div></div>
              <div><div className="text-slate-500 text-xs">Purchased</div><div className="font-medium">{formatDate(active.purchase_date)}</div></div>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs text-slate-500">Currently Assigned</div>
                <div className="text-sm font-medium">
                  {active.assigned_to_name ? `${active.assigned_to_name} (${active.assigned_to_type})` : <span className="text-slate-400">None</span>}
                </div>
              </div>
              {canWrite && active.status === 'active' && (
                <div className="flex gap-2">
                  {!active.assigned_to_name ? (
                    <Button size="sm" onClick={openAssign}><UserCheck className="w-4 h-4" /> Assign</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => returnAsset(active)}><RotateCcw className="w-4 h-4" /> Return</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={depreciate}><TrendingDown className="w-4 h-4" /> Depreciate</Button>
                </div>
              )}
            </div>

            {active.depreciation_rate != null && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Depreciation History</h3>
                {(active as any).depreciation?.length === 0 ? (
                  <EmptyState title="No depreciation logged" description="Click Depreciate to record annual depreciation." />
                ) : (
                  <Table>
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                        <th className="px-3 py-2">Year</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Book Value After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(active as any).depreciation?.map((d: any) => (
                        <tr key={d.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-sm">{d.period_year}</td>
                          <td className="px-3 py-2 text-sm">{formatMoney(d.amount)}</td>
                          <td className="px-3 py-2 text-sm font-medium">{formatMoney(d.book_value_after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            )}

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Assignment History</h3>
              {(active as any).history?.length === 0 ? (
                <EmptyState title="No assignments yet" />
              ) : (
                <Table>
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-3 py-2">Assigned To</th>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">To</th>
                      <th className="px-3 py-2">Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(active as any).history?.map((h: any) => (
                      <tr key={h.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-sm">{h.assigned_to_name} <span className="text-xs text-slate-500">({h.assigned_to_type})</span></td>
                        <td className="px-3 py-2 text-sm">{formatDate(h.assigned_at)}</td>
                        <td className="px-3 py-2 text-sm">{h.returned_at ? formatDate(h.returned_at) : <Badge variant="info">Active</Badge>}</td>
                        <td className="px-3 py-2 text-sm">{h.returned_condition ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Assign modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Asset">
        <form onSubmit={assign} className="space-y-3">
          <FormField label="Assign To Type" required>
            <Select value={assignForm.assigned_to_type} onChange={(e) => setAssignForm({ ...assignForm, assigned_to_type: e.target.value as any })}>
              <option value="staff">Staff</option>
              <option value="student">Student</option>
              <option value="department">Department</option>
              <option value="room">Room</option>
            </Select>
          </FormField>
          <FormField label="Name" required>
            <Input value={assignForm.assigned_to_name} onChange={(e) => setAssignForm({ ...assignForm, assigned_to_name: e.target.value, assigned_to_id: e.target.value })} required maxLength={200} placeholder="e.g., Mr. Sharma or Lab 2" />
          </FormField>
          <FormField label="Notes"><Textarea value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} maxLength={500} rows={2} /></FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button type="submit">Assign</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
