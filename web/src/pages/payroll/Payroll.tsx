import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, CheckCircle, Banknote, Wallet, Users } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatMoney } from '../../lib/format';

interface Structure {
  user_id: string;
  full_name: string | null;
  email: string | null;
  basic: number;
  hra: number;
  transport: number;
  other_allowances: number;
  pf_deduction: number;
  tax_deduction: number;
  other_deductions: number;
  effective_from: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
}

interface Run {
  id: string;
  year: number;
  month: number;
  status: 'draft' | 'approved' | 'paid';
  generated_at: string;
  generated_by_name: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  paid_at: string | null;
  payslip_count: number;
  total_net: number;
  notes: string | null;
}

interface RunDetail extends Run {
  payslips: {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string | null;
    basic: number;
    hra: number;
    transport: number;
    other_allowances: number;
    pf_deduction: number;
    tax_deduction: number;
    other_deductions: number;
    gross: number;
    total_deductions: number;
    net: number;
  }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function totalGross(s: Pick<Structure, 'basic' | 'hra' | 'transport' | 'other_allowances'>) {
  return s.basic + s.hra + s.transport + s.other_allowances;
}
function totalDed(s: Pick<Structure, 'pf_deduction' | 'tax_deduction' | 'other_deductions'>) {
  return s.pf_deduction + s.tax_deduction + s.other_deductions;
}

export default function Payroll() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('payroll.write'));
  const canApprove = useAuthStore((s) => s.hasPerm('payroll.approve'));
  const { show, node } = useToasts();

  const [tab, setTab] = useState<'structures' | 'runs'>('structures');
  const [q, setQ] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Structure | null>(null);
  const [form, setForm] = useState({
    basic: 0, hra: 0, transport: 0, other_allowances: 0,
    pf_deduction: 0, tax_deduction: 0, other_deductions: 0,
    effective_from: '', status: 'active' as 'active' | 'inactive', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ user_id: '', basic: 0 });

  const [runOpen, setRunOpen] = useState(false);
  const [runForm, setRunForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, notes: '' });
  const [creating, setCreating] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: structures, isLoading: structLoading } = useQuery<{ items: Structure[] }>({
    queryKey: ['payroll-structures', q],
    queryFn: () => api.get(`/payroll/structures?q=${encodeURIComponent(q)}`),
    enabled: tab === 'structures',
  });

  const { data: runs, isLoading: runsLoading } = useQuery<{ items: Run[] }>({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs'),
    enabled: tab === 'runs' || detailOpen,
  });

  const { data: runDetail } = useQuery<RunDetail>({
    queryKey: ['payroll-run', detailId],
    queryFn: () => api.get(`/payroll/runs/${detailId}`),
    enabled: !!detailId && detailOpen,
  });

  const openEdit = (s: Structure) => {
    setEditing(s);
    setForm({
      basic: s.basic, hra: s.hra, transport: s.transport, other_allowances: s.other_allowances,
      pf_deduction: s.pf_deduction, tax_deduction: s.tax_deduction, other_deductions: s.other_deductions,
      effective_from: s.effective_from ?? '',
      status: s.status,
      notes: s.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/payroll/structures/${editing.user_id}`, {
        ...form,
        effective_from: form.effective_from || null,
        notes: form.notes || null,
      });
      show('Salary structure saved', 'success');
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ['payroll-structures'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const createStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/payroll/structures/${createForm.user_id}`, {
        basic: createForm.basic,
        hra: 0, transport: 0, other_allowances: 0,
        pf_deduction: 0, tax_deduction: 0, other_deductions: 0,
        effective_from: new Date().toISOString().slice(0, 10),
        status: 'active',
      });
      show('Salary structure created', 'success');
      setCreateOpen(false);
      setCreateForm({ user_id: '', basic: 0 });
      qc.invalidateQueries({ queryKey: ['payroll-structures'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const createRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/payroll/runs', {
        year: runForm.year,
        month: runForm.month,
        notes: runForm.notes || null,
      });
      show('Payroll run generated', 'success');
      setRunOpen(false);
      setRunForm({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, notes: '' });
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const approveRun = async (id: string) => {
    try {
      await api.patch(`/payroll/runs/${id}/approve`, {});
      show('Run approved', 'success');
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-run', id] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const payRun = async (id: string) => {
    if (!confirm('Mark this payroll run as paid?')) return;
    try {
      await api.patch(`/payroll/runs/${id}/pay`, {});
      show('Run marked as paid', 'success');
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['payroll-run', id] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const deleteRun = async (id: string) => {
    if (!confirm('Delete this draft run?')) return;
    try {
      await api.delete(`/payroll/runs/${id}`);
      show('Run deleted', 'success');
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const totals = (structures?.items ?? []).reduce(
    (acc, s) => ({
      gross: acc.gross + totalGross(s),
      ded: acc.ded + totalDed(s),
      net: acc.net + totalGross(s) - totalDed(s),
    }),
    { gross: 0, ded: 0, net: 0 },
  );

  return (
    <div>
      {node}
      <PageHeader
        title="Payroll"
        actions={
          <div className="flex gap-2">
            {canWrite && tab === 'structures' && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" /> New Structure
              </Button>
            )}
            {canWrite && tab === 'runs' && (
              <Button onClick={() => setRunOpen(true)}>
                <Plus className="w-4 h-4" /> Generate Run
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab('structures')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1 ${
            tab === 'structures' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" /> Salary Structures
        </button>
        <button
          onClick={() => setTab('runs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1 ${
            tab === 'runs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4" /> Payroll Runs
        </button>
      </div>

      {tab === 'structures' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="p-4">
              <div className="text-sm text-slate-500">Total monthly gross</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totals.gross)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-500">Total deductions</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totals.ded)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-500">Total net payout</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-700">{formatMoney(totals.net)}</div>
            </Card>
          </div>

          <Card className="p-4 mb-4">
            <Input
              placeholder="Search by name or email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Card>

          <Card>
            {structLoading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : (structures?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No salary structures"
                description="Create salary structures for staff and teachers to enable payroll runs."
              />
            ) : (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Basic</th>
                    <th className="px-4 py-3">HRA</th>
                    <th className="px-4 py-3">Other Allow.</th>
                    <th className="px-4 py-3">PF</th>
                    <th className="px-4 py-3">Tax</th>
                    <th className="px-4 py-3">Net</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {structures!.items.map((s) => {
                    const gross = totalGross(s);
                    const ded = totalDed(s);
                    return (
                      <tr key={s.user_id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-slate-900">{s.full_name}</div>
                          <div className="text-xs text-slate-500">{s.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(s.basic)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(s.hra)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(s.transport + s.other_allowances)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(s.pf_deduction)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatMoney(s.tax_deduction)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{formatMoney(gross - ded)}</td>
                        <td className="px-4 py-3"><Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          {canWrite && (
                            <button
                              onClick={() => openEdit(s)}
                              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}

      {tab === 'runs' && (
        <Card>
          {runsLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (runs?.items.length ?? 0) === 0 ? (
            <EmptyState title="No payroll runs" description="Generate your first monthly payroll run." />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payslips</th>
                  <th className="px-4 py-3">Total Net</th>
                  <th className="px-4 py-3">Generated By</th>
                  <th className="px-4 py-3">Paid At</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {runs!.items.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {MONTHS[r.month - 1]} {r.year}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={r.status === 'paid' ? 'success' : r.status === 'approved' ? 'info' : 'warning'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.payslip_count}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatMoney(r.total_net)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.generated_by_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.paid_at ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setDetailId(r.id); setDetailOpen(true); }}
                        className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs"
                      >
                        View
                      </button>
                      {canApprove && r.status === 'draft' && (
                        <button
                          onClick={() => approveRun(r.id)}
                          className="text-emerald-700 hover:bg-emerald-50 p-1.5 rounded ml-1"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {canApprove && r.status === 'approved' && (
                        <button
                          onClick={() => payRun(r.id)}
                          className="text-blue-700 hover:bg-blue-50 p-1.5 rounded ml-1"
                          title="Mark paid"
                        >
                          <Banknote className="w-4 h-4" />
                        </button>
                      )}
                      {canWrite && r.status === 'draft' && (
                        <button
                          onClick={() => deleteRun(r.id)}
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1"
                          title="Delete"
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

      {/* Edit structure modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editing ? `Edit ${editing.full_name}` : 'Edit'} size="lg">
        {editing && (
          <form onSubmit={saveStructure} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Basic" required>
                <Input
                  type="number" min={0} step="0.01"
                  value={form.basic}
                  onChange={(e) => setForm({ ...form, basic: Number(e.target.value) })}
                  required
                />
              </FormField>
              <FormField label="HRA">
                <Input
                  type="number" min={0} step="0.01"
                  value={form.hra}
                  onChange={(e) => setForm({ ...form, hra: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Transport Allowance">
                <Input
                  type="number" min={0} step="0.01"
                  value={form.transport}
                  onChange={(e) => setForm({ ...form, transport: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Other Allowances">
                <Input
                  type="number" min={0} step="0.01"
                  value={form.other_allowances}
                  onChange={(e) => setForm({ ...form, other_allowances: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="PF Deduction">
                <Input
                  type="number" min={0} step="0.01"
                  value={form.pf_deduction}
                  onChange={(e) => setForm({ ...form, pf_deduction: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Tax (TDS)">
                <Input
                  type="number" min={0} step="0.01"
                  value={form.tax_deduction}
                  onChange={(e) => setForm({ ...form, tax_deduction: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Other Deductions">
                <Input
                  type="number" min={0} step="0.01"
                  value={form.other_deductions}
                  onChange={(e) => setForm({ ...form, other_deductions: Number(e.target.value) })}
                />
              </FormField>
              <FormField label="Effective From">
                <Input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Status">
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </FormField>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-slate-600">Gross:</span>
              <span className="font-medium">{formatMoney(form.basic + form.hra + form.transport + form.other_allowances)}</span>
              <span className="text-slate-600 ml-4">Deductions:</span>
              <span className="font-medium">{formatMoney(form.pf_deduction + form.tax_deduction + form.other_deductions)}</span>
              <span className="text-slate-600 ml-4">Net:</span>
              <span className="font-semibold text-emerald-700">{formatMoney(form.basic + form.hra + form.transport + form.other_allowances - form.pf_deduction - form.tax_deduction - form.other_deductions)}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Create structure modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Salary Structure">
        <form onSubmit={createStructure} className="space-y-3">
          <FormField label="User ID" required hint="Paste the user's ID (id column from /users)">
            <Input
              value={createForm.user_id}
              onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
              required
              placeholder="usr_..."
            />
          </FormField>
          <FormField label="Basic Salary" required>
            <Input
              type="number" min={0} step="0.01"
              value={createForm.basic}
              onChange={(e) => setCreateForm({ ...createForm, basic: Number(e.target.value) })}
              required
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Generate run modal */}
      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="Generate Payroll Run">
        <form onSubmit={createRun} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Year" required>
              <Input
                type="number" min={2000} max={2100}
                value={runForm.year}
                onChange={(e) => setRunForm({ ...runForm, year: Number(e.target.value) })}
                required
              />
            </FormField>
            <FormField label="Month" required>
              <Select
                value={runForm.month}
                onChange={(e) => setRunForm({ ...runForm, month: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Notes">
            <Input
              value={runForm.notes}
              onChange={(e) => setRunForm({ ...runForm, notes: e.target.value })}
              placeholder="Optional"
            />
          </FormField>
          <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
            Generates payslips for all users with active salary structures. Run can be approved and paid later.
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setRunOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? 'Generating...' : 'Generate'}</Button>
          </div>
        </form>
      </Modal>

      {/* Run detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={runDetail ? `${MONTHS[runDetail.month - 1]} ${runDetail.year} Payroll` : 'Run'} size="xl">
        {runDetail && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded p-3">
                <div className="text-xs text-slate-500">Payslips</div>
                <div className="text-2xl font-semibold">{runDetail.payslips.length}</div>
              </div>
              <div className="bg-slate-50 rounded p-3">
                <div className="text-xs text-slate-500">Total Net</div>
                <div className="text-2xl font-semibold text-emerald-700">{formatMoney(runDetail.total_net)}</div>
              </div>
              <div className="bg-slate-50 rounded p-3">
                <div className="text-xs text-slate-500">Status</div>
                <div className="mt-1"><Badge variant={runDetail.status === 'paid' ? 'success' : runDetail.status === 'approved' ? 'info' : 'warning'}>{runDetail.status}</Badge></div>
              </div>
            </div>
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {runDetail.payslips.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-sm">
                      <div className="font-medium text-slate-900">{p.user_name}</div>
                      <div className="text-xs text-slate-500">{p.user_email}</div>
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700">{formatMoney(p.gross)}</td>
                    <td className="px-4 py-2 text-sm text-slate-700">{formatMoney(p.total_deductions)}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-emerald-700">{formatMoney(p.net)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
