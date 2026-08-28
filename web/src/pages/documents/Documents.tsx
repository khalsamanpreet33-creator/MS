import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileText, Calendar, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate, classNames } from '../../lib/format';

interface Document {
  id: string;
  title: string;
  document_type: string;
  related_to: 'student' | 'staff' | 'general';
  related_id: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  expiry_date: string | null;
  notes: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
}

const DOC_TYPES = [
  'Birth Certificate', 'Aadhaar Card', 'Transfer Certificate',
  'Mark Sheet', 'Photo', 'Medical Report', 'ID Proof', 'Contract',
  'Resume', 'Other',
];

export default function Documents() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('documents.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('documents.delete'));
  const { show, node } = useToasts();

  const [filterRelated, setFilterRelated] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', document_type: 'Other', related_to: 'general' as Document['related_to'],
    related_id: '', file_path: '', file_size: '', mime_type: '',
    expiry_date: '', notes: '',
  });

  const { data, isLoading } = useQuery<{ items: Document[] }>({
    queryKey: ['documents', filterRelated, expiringOnly],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterRelated) params.set('relatedTo', filterRelated);
      if (expiringOnly) params.set('expiring', '1');
      return api.get(`/documents?${params}`);
    },
  });

  const open = () => {
    setForm({
      title: '', document_type: 'Other', related_to: 'general',
      related_id: '', file_path: '', file_size: '', mime_type: '',
      expiry_date: '', notes: '',
    });
    setCreateOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/documents', {
        title: form.title,
        document_type: form.document_type,
        related_to: form.related_to,
        related_id: form.related_id || null,
        file_path: form.file_path,
        file_size: form.file_size ? Number(form.file_size) : null,
        mime_type: form.mime_type || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
      });
      show('Document added', 'success');
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (d: Document) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    try {
      await api.delete(`/documents/${d.id}`);
      show('Document removed', 'success');
      qc.invalidateQueries({ queryKey: ['documents'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const isExpired = (d: Document) =>
    !!d.expiry_date && new Date(d.expiry_date) < new Date();
  const isExpiring = (d: Document) => {
    if (!d.expiry_date) return false;
    const days = Math.floor((new Date(d.expiry_date).getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days <= 30;
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Documents"
        description={`${data?.items.length ?? 0} document(s)`}
        actions={
          canWrite && <Button onClick={open}><Plus className="w-4 h-4" /> Add Document</Button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterRelated} onChange={(e) => setFilterRelated(e.target.value)} className="w-auto">
            <option value="">All types</option>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
            <option value="general">General</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={expiringOnly}
              onChange={(e) => setExpiringOnly(e.target.checked)}
            />
            Expiring in 30 days
          </label>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No documents"
            description="Upload a document to get started."
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Related</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-medium text-slate-900">{d.title}</div>
                        {d.notes && <div className="text-xs text-slate-500">{d.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="info">{d.document_type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-slate-700">{d.related_to}</td>
                  <td className="px-4 py-3 text-sm">
                    {d.expiry_date ? (
                      <div className={classNames(
                        'flex items-center gap-1',
                        isExpired(d) ? 'text-red-600 font-semibold' :
                        isExpiring(d) ? 'text-amber-600 font-medium' : 'text-slate-700',
                      )}>
                        {(isExpired(d) || isExpiring(d)) && <AlertTriangle className="w-3 h-3" />}
                        <Calendar className="w-3 h-3" />
                        {formatDate(d.expiry_date)}
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(d.uploaded_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {canDelete && (
                      <button onClick={() => remove(d)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Document" size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Title" required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} />
            </FormField>
            <FormField label="Document Type" required>
              <Select value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Related To" required>
              <Select value={form.related_to} onChange={(e) => setForm({ ...form, related_to: e.target.value as Document['related_to'] })}>
                <option value="general">General</option>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </Select>
            </FormField>
            <FormField label="Related ID" hint="Student or staff ID (optional)">
              <Input value={form.related_id} onChange={(e) => setForm({ ...form, related_id: e.target.value })} />
            </FormField>
            <FormField label="File Path" required>
              <Input value={form.file_path} onChange={(e) => setForm({ ...form, file_path: e.target.value })} required placeholder="/uploads/..." />
            </FormField>
            <FormField label="File Size (bytes)">
              <Input type="number" value={form.file_size} onChange={(e) => setForm({ ...form, file_size: e.target.value })} />
            </FormField>
            <FormField label="Expiry Date">
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </FormField>
            <FormField label="MIME Type">
              <Input value={form.mime_type} onChange={(e) => setForm({ ...form, mime_type: e.target.value })} placeholder="application/pdf" />
            </FormField>
          </div>
          <FormField label="Notes">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}