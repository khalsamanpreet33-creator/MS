import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Send, CheckCircle, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDateTime } from '../../lib/format';

interface Alert {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  channels: string;
  status: 'active' | 'resolved' | 'cancelled';
  created_at: string;
  resolved_at: string | null;
  creator_name?: string | null;
}

const SEV_VARIANT: Record<Alert['severity'], 'info' | 'warning' | 'danger'> = {
  info: 'info', warning: 'warning', critical: 'danger',
};
const STATUS_VARIANT: Record<Alert['status'], 'danger' | 'success' | 'default'> = {
  active: 'danger', resolved: 'success', cancelled: 'default',
};

export default function Emergency() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('emergency.write'));
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', body: '', severity: 'critical' as Alert['severity'],
    channels: 'inapp,sms,email,whatsapp',
  });

  const { data = { items: [] as Alert[] }, isLoading } = useQuery<{ items: Alert[] }>({
    queryKey: ['emergency'],
    queryFn: () => api.get('/emergency'),
  });

  const trigger = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<{ id: string; recipients: number }>('/emergency', form);
      show(`Alert sent to ${r.recipients} user(s)`, 'success');
      setOpen(false);
      setForm({ title: '', body: '', severity: 'critical', channels: 'inapp,sms,email,whatsapp' });
      qc.invalidateQueries({ queryKey: ['emergency'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const resolve = async (a: Alert) => {
    try {
      await api.post(`/emergency/${a.id}/resolve`);
      show('Alert resolved', 'success');
      qc.invalidateQueries({ queryKey: ['emergency'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const cancel = async (a: Alert) => {
    if (!confirm(`Cancel alert "${a.title}"?`)) return;
    try {
      await api.post(`/emergency/${a.id}/cancel`);
      show('Alert cancelled', 'success');
      qc.invalidateQueries({ queryKey: ['emergency'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Emergency Alerts"
        description="High-priority broadcasts via SMS/email/WhatsApp/in-app"
        actions={canWrite && (
          <Button variant="danger" onClick={() => setOpen(true)}>
            <AlertTriangle className="w-4 h-4" /> Trigger Alert
          </Button>
        )}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : data.items.length === 0 ? (
          <EmptyState title="No alerts" description="No emergency alerts have been raised." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Raised</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{a.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-1">{a.body}</div>
                  </td>
                  <td className="px-4 py-3"><Badge variant={SEV_VARIANT[a.severity]}>{a.severity}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{a.channels}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge></td>
                  <td className="px-4 py-3 text-sm">{formatDateTime(a.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && a.status === 'active' && (
                      <>
                        <button onClick={() => resolve(a)} title="Resolve" className="text-green-600 hover:bg-green-50 p-1.5 rounded">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => cancel(a)} title="Cancel" className="text-slate-500 hover:bg-slate-100 p-1.5 rounded ml-1">
                          <X className="w-4 h-4" />
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

      <Modal open={open} onClose={() => setOpen(false)} title="Trigger Emergency Alert">
        <form onSubmit={trigger} className="space-y-3">
          <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            Emergency alerts broadcast immediately to all channels and recipients. Use only for genuine emergencies.
          </div>
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
          </FormField>
          <FormField label="Body" required>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} required maxLength={2000} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Severity">
              <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Alert['severity'] })}>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </Select>
            </FormField>
            <FormField label="Channels" hint="comma-separated">
              <Input value={form.channels} onChange={(e) => setForm({ ...form, channels: e.target.value })} required />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger"><Send className="w-4 h-4" /> Send Alert</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
