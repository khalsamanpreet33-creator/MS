import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Users, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDateTime } from '../../lib/format';

interface Campaign {
  id: string;
  name: string;
  audience: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'inapp';
  subject: string | null;
  body: string;
  total_recipients: number;
  status: 'draft' | 'sending' | 'sent' | 'failed' | 'partial';
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  creator_name?: string | null;
}

const CHANNEL_ICON = {
  sms: Smartphone,
  email: Mail,
  whatsapp: MessageSquare,
  inapp: Users,
};

const AUDIENCES = [
  { value: 'all_parents', label: 'All Parents' },
  { value: 'all_staff', label: 'All Staff' },
  { value: 'all_students', label: 'All Students' },
];

export default function BulkComm() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('bulkcomm.write'));
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', audience: 'all_parents', channel: 'sms' as Campaign['channel'],
    subject: '', body: '',
  });
  const [preview, setPreview] = useState<{ count: number; loading: boolean }>({ count: 0, loading: false });

  const { data = { items: [] as Campaign[] }, isLoading } = useQuery<{ items: Campaign[] }>({
    queryKey: ['bulk-comm'],
    queryFn: () => api.get('/bulk-comm'),
  });

  const loadPreview = async (audience: string) => {
    setPreview({ count: 0, loading: true });
    try {
      const r = await api.post<{ count: number }>('/bulk-comm/preview', { audience });
      setPreview({ count: r.count, loading: false });
    } catch {
      setPreview({ count: 0, loading: false });
    }
  };

  const openEditor = () => {
    setForm({ name: '', audience: 'all_parents', channel: 'sms', subject: '', body: '' });
    setPreview({ count: 0, loading: false });
    setOpen(true);
    loadPreview('all_parents');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<{ id: string; recipients: number }>('/bulk-comm', {
        ...form,
        subject: form.subject || null,
      });
      show(`Campaign queued — ${r.recipients} recipient(s)`, 'success');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['bulk-comm'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Bulk Communication"
        description="Send SMS / email / WhatsApp / in-app messages to audience groups"
        actions={canWrite && <Button onClick={openEditor}><Send className="w-4 h-4" /> New Campaign</Button>}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : data.items.length === 0 ? (
          <EmptyState title="No campaigns" description="Send your first bulk message." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => {
                const Icon = CHANNEL_ICON[c.channel];
                return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{c.body}</div>
                    </td>
                    <td className="px-4 py-3"><Badge variant="info">{c.audience}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-slate-500" />
                        <span className="text-sm">{c.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{c.total_recipients}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === 'draft' ? 'default' : c.status === 'sent' ? 'success' : 'warning'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDateTime(c.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Bulk Campaign" size="lg">
        <form onSubmit={send} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
            </FormField>
            <FormField label="Audience" required>
              <Select value={form.audience} onChange={(e) => { setForm({ ...form, audience: e.target.value }); loadPreview(e.target.value); }} required>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Channel" required>
              <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Campaign['channel'] })}>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="inapp">In-App</option>
              </Select>
            </FormField>
            <FormField label="Subject" hint="Used for email/inapp">
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} />
            </FormField>
          </div>
          <FormField label="Message" required>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} required maxLength={5000} />
          </FormField>
          <div className="p-3 rounded bg-slate-50 border border-slate-200 text-sm text-slate-700">
            {preview.loading ? 'Counting recipients…' : `Estimated recipients: ${preview.count}`}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={preview.count === 0}><Send className="w-4 h-4" /> Queue Campaign</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
