import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Filter, Plus } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Input, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDateTime, formatMoney } from '../../lib/format';

interface QueueItem {
  id: string;
  type: 'leave' | 'concession' | 'refund';
  ref: string;
  requester_name: string | null;
  requester_label: string;
  summary: string;
  amount: number | null;
  requested_at: string;
  status: string;
}

interface Student { id: string; admission_no: string; first_name: string; last_name: string }

const TYPE_VARIANT: Record<QueueItem['type'], 'info' | 'warning' | 'success'> = {
  leave: 'info', concession: 'warning', refund: 'success',
};
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  pending: 'warning', approved: 'success', rejected: 'danger', processed: 'success', revoked: 'default',
};

export default function Approvals() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('approvals.write'));
  const { show, node } = useToasts();
  const [type, setType] = useState<'all' | 'leave' | 'concession' | 'refund'>('all');
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [deciding, setDeciding] = useState<{ id: string; type: string } | null>(null);
  const [notes, setNotes] = useState('');

  const { data = { items: [] as QueueItem[] }, isLoading } = useQuery<{ items: QueueItem[] }>({
    queryKey: ['approvals-queue', type, status],
    queryFn: () => api.get(`/approvals/queue?type=${type}&status=${status}`),
  });

  const decide = async () => {
    if (!deciding) return;
    try {
      await api.post(`/approvals/${deciding.type === 'leave' ? 'leave' : deciding.type === 'concession' ? 'concessions' : 'refunds'}/${deciding.id}/decision`, {
        decision: status === 'pending' ? 'approved' : 'approved',
        notes: notes || null,
      });
      show('Approved', 'success');
      setDeciding(null);
      setNotes('');
      qc.invalidateQueries({ queryKey: ['approvals-queue'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const reject = async () => {
    if (!deciding) return;
    try {
      await api.post(`/approvals/${deciding.type === 'leave' ? 'leave' : deciding.type === 'concession' ? 'concessions' : 'refunds'}/${deciding.id}/decision`, {
        decision: 'rejected', notes: notes || null,
      });
      show('Rejected', 'success');
      setDeciding(null);
      setNotes('');
      qc.invalidateQueries({ queryKey: ['approvals-queue'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  // New concession request
  const [conOpen, setConOpen] = useState(false);
  const [conForm, setConForm] = useState({
    student_id: '', reason: '', concession_type: 'percentage' as 'percentage' | 'fixed',
    concession_value: 0, valid_from: new Date().toISOString().slice(0, 10), valid_to: '',
  });
  const { data: studentsList = { items: [] as Array<{ id: string; admission_no: string; first_name: string; last_name: string }> } } = useQuery<{ items: Array<{ id: string; admission_no: string; first_name: string; last_name: string }> }>({
    queryKey: ['students-for-approvals'],
    queryFn: () => api.get<{ items: Array<{ id: string; admission_no: string; first_name: string; last_name: string }> }>('/students?limit=100'),
    enabled: conOpen,
  });
  const submitConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/approvals/concessions', {
        ...conForm,
        valid_to: conForm.valid_to || null,
      });
      show('Concession requested — pending approval', 'success');
      setConOpen(false);
      setConForm({ student_id: '', reason: '', concession_type: 'percentage', concession_value: 0, valid_from: new Date().toISOString().slice(0, 10), valid_to: '' });
      qc.invalidateQueries({ queryKey: ['approvals-queue'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Approval Centre"
        description={`${data.items.length} item(s)`}
        actions={canWrite && <Button variant="secondary" onClick={() => setConOpen(true)}><Plus className="w-4 h-4" /> New Concession Request</Button>}
      />

      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="all">All types</option>
            <option value="leave">Leave</option>
            <option value="concession">Fee concession</option>
            <option value="refund">Refund</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> :
          data.items.length === 0 ? <EmptyState title="Nothing to review" description="No items match the current filters." /> :
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Requested For</th>
                <th className="px-4 py-3">Detail</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={`${it.type}:${it.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3"><Badge variant={TYPE_VARIANT[it.type]}>{it.type}</Badge></td>
                  <td className="px-4 py-3 text-sm">{it.ref}</td>
                  <td className="px-4 py-3 text-sm font-medium">{it.requester_label}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 line-clamp-1">{it.summary}</td>
                  <td className="px-4 py-3 text-sm">{it.amount != null ? formatMoney(it.amount) : '-'}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[it.status] ?? 'default'}>{it.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(it.requested_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && it.status === 'pending' && (
                      <button onClick={() => { setDeciding({ id: it.id, type: it.type }); setNotes(''); }} className="text-blue-600 hover:underline text-sm">Review</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        }
      </Card>

      <Modal open={!!deciding} onClose={() => setDeciding(null)} title="Review request">
        <div className="space-y-3">
          <FormField label="Decision notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Optional notes for the requester / audit log..." />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setDeciding(null)}>Cancel</Button>
            <Button variant="danger" onClick={reject}><X className="w-4 h-4" /> Reject</Button>
            <Button onClick={decide}><Check className="w-4 h-4" /> Approve</Button>
          </div>
        </div>
      </Modal>

      <Modal open={conOpen} onClose={() => setConOpen(false)} title="New Fee Concession Request" size="lg">
        <form onSubmit={submitConcession} className="space-y-3">
          <FormField label="Student" required>
            <Select value={conForm.student_id} onChange={(e) => setConForm({ ...conForm, student_id: e.target.value })} required>
              <option value="">Select student...</option>
              {studentsList.items.map((s) => <option key={s.id} value={s.id}>{s.admission_no} — {s.first_name} {s.last_name}</option>)}
            </Select>
          </FormField>
          <FormField label="Reason" required>
            <Input value={conForm.reason} onChange={(e) => setConForm({ ...conForm, reason: e.target.value })} required maxLength={500} placeholder="e.g. Sibling discount, merit scholarship..." />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Type">
              <Select value={conForm.concession_type} onChange={(e) => setConForm({ ...conForm, concession_type: e.target.value as 'percentage' | 'fixed' })}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed ₹</option>
              </Select>
            </FormField>
            <FormField label="Value" required>
              <Input type="number" min={0} step="0.01" value={conForm.concession_value} onChange={(e) => setConForm({ ...conForm, concession_value: Number(e.target.value) })} required />
            </FormField>
            <FormField label="Valid From" required>
              <Input type="date" value={conForm.valid_from} onChange={(e) => setConForm({ ...conForm, valid_from: e.target.value })} required />
            </FormField>
          </div>
          <FormField label="Valid To" hint="Leave blank for open-ended">
            <Input type="date" value={conForm.valid_to} onChange={(e) => setConForm({ ...conForm, valid_to: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setConOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
