import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Printer, Wallet } from 'lucide-react';
import { api, ApiError, downloadFile } from '../lib/api';
import {
  PageHeader, Card, Button, Select, Input, useToasts, Table, Modal, FormField, Badge,
} from '../components/ui';
import { useAuthStore } from '../store/auth';
import { formatMoney, formatDate } from '../lib/format';

interface StructureItem {
  id: string; class_id: string; class_name: string; name: string;
  amount: number; frequency: string; due_day_of_month: number;
}

interface InvoiceItem {
  id: string; invoice_no: string; student_id: string; first_name: string; last_name: string;
  admission_no: string; period_label: string; amount: number; paid: number; balance: number;
  status: string; due_date: string; class_name: string | null; section_name: string | null;
}

interface PaymentItem {
  id: string; receipt_no: string; first_name: string; last_name: string; admission_no: string;
  amount: number; payment_mode: string; payment_date: string; collected_by_name: string | null;
}

export default function Fees() {
  const canCollect = useAuthStore((s) => s.hasPerm('fees.collect'));
  const canWrite = useAuthStore((s) => s.hasPerm('fees.write'));
  const [tab, setTab] = useState<'structures' | 'invoices' | 'payments'>('structures');

  return (
    <div>
      <PageHeader
        title="Fees"
        description="Structures, invoices and payment receipts"
      />
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['structures', 'invoices', 'payments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'structures' && <StructuresTab canWrite={canWrite} />}
      {tab === 'invoices' && <InvoicesTab canWrite={canWrite} />}
      {tab === 'payments' && <PaymentsTab canCollect={canCollect} />}
    </div>
  );
}

function StructuresTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ class_id: '', name: '', amount: 0, due_day_of_month: 10 });

  const { data: structures = [] } = useQuery<StructureItem[]>({
    queryKey: ['fee-structures'],
    queryFn: () => api.get('/fees/structures').then((r: { items: StructureItem[] }) => r.items),
  });

  const { data: classes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: { id: string; name: string }[] }) => r.items),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/fees/structures', { ...form, frequency: 'monthly' });
      show('Structure created', 'success');
      setShowAdd(false);
      setForm({ class_id: '', name: '', amount: 0, due_day_of_month: 10 });
      qc.invalidateQueries({ queryKey: ['fee-structures'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      <div className="flex justify-end mb-3">
        {canWrite && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> New structure
          </Button>
        )}
      </div>
      <Card>
        <Table>
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr><th className="px-4 py-3 text-left">Class</th><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Due day</th></tr>
          </thead>
          <tbody>
            {structures.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{s.class_name}</td>
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3 text-right">{formatMoney(s.amount)}</td>
                <td className="px-4 py-3">{s.due_day_of_month} of month</td>
              </tr>
            ))}
            {structures.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No fee structures yet.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New fee structure">
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Class" required>
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </FormField>
          <FormField label="Amount" required>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
          </FormField>
          <FormField label="Due day of month" required>
            <Input type="number" min="1" max="28" value={form.due_day_of_month} onChange={(e) => setForm({ ...form, due_day_of_month: Number(e.target.value) })} required />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InvoicesTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [showGenerate, setShowGenerate] = useState(false);
  const [form, setForm] = useState({
    class_id: '', section_id: '', structure_id: '',
    period_label: new Date().toISOString().slice(0, 7),
    period_start: new Date().toISOString().slice(0, 8) + '01',
    period_end: '',
    due_date: '',
  });

  const { data: structures = [] } = useQuery<StructureItem[]>({
    queryKey: ['fee-structures'],
    queryFn: () => api.get('/fees/structures').then((r: { items: StructureItem[] }) => r.items),
  });

  const { data: classes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: { id: string; name: string }[] }) => r.items),
  });

  const { data: invoices = [] } = useQuery<InvoiceItem[]>({
    queryKey: ['fee-invoices'],
    queryFn: () => api.get('/fees/invoices').then((r: { items: InvoiceItem[] }) => r.items),
  });

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<{ created: number }>('/fees/invoices/generate', form);
      show(`${r.created} invoices created`, 'success');
      setShowGenerate(false);
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      <div className="flex justify-end mb-3">
        {canWrite && (
          <Button onClick={() => setShowGenerate(true)}>
            <Plus className="w-4 h-4" /> Generate invoices
          </Button>
        )}
      </div>
      <Card>
        <Table>
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.slice(0, 100).map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{i.invoice_no}</td>
                <td className="px-4 py-2">{i.first_name} {i.last_name}</td>
                <td className="px-4 py-2">{i.period_label}</td>
                <td className="px-4 py-2 text-right">{formatMoney(i.amount)}</td>
                <td className="px-4 py-2 text-right text-emerald-700">{formatMoney(i.paid)}</td>
                <td className="px-4 py-2 text-right text-amber-700">{formatMoney(i.balance)}</td>
                <td className="px-4 py-2">
                  <Badge variant={i.status === 'paid' ? 'success' : i.status === 'partial' ? 'warning' : i.status === 'cancelled' ? 'default' : 'danger'}>
                    {i.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No invoices yet.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate monthly invoices">
        <form onSubmit={generate} className="space-y-3">
          <FormField label="Class" required>
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, structure_id: '' })} required>
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Fee structure" required>
            <Select value={form.structure_id} onChange={(e) => setForm({ ...form, structure_id: e.target.value })} required>
              <option value="">—</option>
              {structures.filter((s) => !form.class_id || s.class_id === form.class_id).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({formatMoney(s.amount)})</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Period label" required>
            <Input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="2025-08" required />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Period start" required>
              <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} required />
            </FormField>
            <FormField label="Period end" required>
              <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} required />
            </FormField>
            <FormField label="Due date" required>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Generate</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PaymentsTab({ canCollect }: { canCollect: boolean }) {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [showPay, setShowPay] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'bank' | 'cheque' | 'card'>('cash');
  const [reference, setReference] = useState('');

  const { data: payments = [] } = useQuery<PaymentItem[]>({
    queryKey: ['fee-payments'],
    queryFn: () => api.get('/fees/payments').then((r: { items: PaymentItem[] }) => r.items),
  });

  const { data: students = [] } = useQuery<{ id: string; first_name: string; last_name: string; admission_no: string }[]>({
    queryKey: ['students-active'],
    queryFn: () => api.get('/students?pageSize=200').then((r: { items: { id: string; first_name: string; last_name: string; admission_no: string }[] }) => r.items),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<{ paymentId: string; receipt: string }>('/fees/payments', {
        student_id: studentId,
        amount,
        payment_mode: paymentMode,
        reference,
      });
      show(`Payment recorded: ${r.receipt}`, 'success');
      setShowPay(false);
      setAmount(0); setReference(''); setStudentId('');
      qc.invalidateQueries({ queryKey: ['fee-payments'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      <div className="flex justify-end mb-3">
        {canCollect && (
          <Button onClick={() => setShowPay(true)}>
            <Wallet className="w-4 h-4" /> Record payment
          </Button>
        )}
      </div>
      <Card>
        <Table>
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Receipt</th>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Mode</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{p.receipt_no}</td>
                <td className="px-4 py-2">{p.first_name} {p.last_name}</td>
                <td className="px-4 py-2">{formatDate(p.payment_date)}</td>
                <td className="px-4 py-2 uppercase">{p.payment_mode}</td>
                <td className="px-4 py-2 text-right font-medium">{formatMoney(p.amount)}</td>
                <td className="px-4 py-2 text-slate-500">{p.collected_by_name ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => downloadFile(`/fees/receipts/${p.id}?format=pdf`, `${p.receipt_no}.pdf`)}
                    className="text-blue-700 hover:underline text-xs"
                  >
                    <Printer className="w-3 h-3 inline" /> PDF
                  </button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No payments yet.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      <Modal open={showPay} onClose={() => setShowPay(false)} title="Record fee payment">
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Student" required>
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
              <option value="">—</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Amount" required>
            <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
          </FormField>
          <FormField label="Mode" required>
            <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
            </Select>
          </FormField>
          <FormField label="Reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no / UPI txn id" />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit">Save payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}