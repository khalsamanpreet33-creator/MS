import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileCheck, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface CertificateTemplate {
  id: string;
  name: string;
  certificate_type: 'bonafide' | 'transfer' | 'character' | 'achievement' | 'completion' | 'custom';
  template_html: string;
  status: 'active' | 'inactive';
}

interface IssuedCert {
  id: string;
  template_id: string;
  template_name: string;
  certificate_type: string;
  certificate_number: string;
  issued_to_name: string;
  issued_to_id: string | null;
  issued_date: string;
  details: string | null;
  created_at: string;
}

const DEFAULT_BONAFIDE = `<div class="certificate bonafide">
  <h1>BONAFIDE CERTIFICATE</h1>
  <p>This is to certify that <strong>{{name}}</strong>, {{age}} years old,
     is a bonafide student of this institution studying in
     <strong>{{class_name}} - {{section_name}}</strong> during the academic year {{academic_year}}.</p>
  <p>Admission No: <strong>{{admission_no}}</strong></p>
  <p>This certificate is issued on request for {{purpose}}.</p>
  <div class="signature">Principal</div>
</div>`;

const DEFAULT_TRANSFER = `<div class="certificate transfer">
  <h1>TRANSFER CERTIFICATE</h1>
  <p>School Code: {{school_code}}</p>
  <p>Admission No: {{admission_no}}</p>
  <p>Name: <strong>{{name}}</strong></p>
  <p>Father/Guardian: {{guardian_name}}</p>
  <p>Nationality: {{nationality}}</p>
  <p>Date of Birth: {{date_of_birth}}</p>
  <p>Last class attended: {{class_name}}</p>
  <p>Reason for leaving: {{reason}}</p>
</div>`;

export default function Certificates() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('certificates.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('certificates.delete'));
  const { show, node } = useToasts();

  const [tab, setTab] = useState<'issued' | 'templates'>('issued');

  const [tplOpen, setTplOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<CertificateTemplate | null>(null);
  const [tplForm, setTplForm] = useState({
    name: '', certificate_type: 'bonafide' as CertificateTemplate['certificate_type'],
    template_html: DEFAULT_BONAFIDE, status: 'active' as CertificateTemplate['status'],
  });

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    template_id: '', issued_to_name: '', issued_to_id: '',
    issued_date: new Date().toISOString().slice(0, 10),
    details: '',
  });

  const { data: tpls = { items: [] as CertificateTemplate[] } } = useQuery<{ items: CertificateTemplate[] }>({
    queryKey: ['cert-templates'],
    queryFn: () => api.get('/certificates/templates'),
  });

  const { data: issued = { items: [] as IssuedCert[] }, isLoading: iLoading } = useQuery<{ items: IssuedCert[] }>({
    queryKey: ['cert-issued'],
    queryFn: () => api.get('/certificates/issued'),
  });

  const openTpl = (t?: CertificateTemplate) => {
    if (t) {
      setEditingTpl(t);
      setTplForm({ name: t.name, certificate_type: t.certificate_type, template_html: t.template_html, status: t.status });
    } else {
      setEditingTpl(null);
      setTplForm({ name: '', certificate_type: 'bonafide', template_html: DEFAULT_BONAFIDE, status: 'active' });
    }
    setTplOpen(true);
  };

  const saveTpl = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: tplForm.name,
        certificate_type: tplForm.certificate_type,
        template_html: tplForm.template_html,
        status: tplForm.status,
      };
      if (editingTpl) {
        await api.patch(`/certificates/templates/${editingTpl.id}`, payload);
        show('Template updated', 'success');
      } else {
        await api.post('/certificates/templates', payload);
        show('Template created', 'success');
      }
      setTplOpen(false);
      qc.invalidateQueries({ queryKey: ['cert-templates'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const removeTpl = async (t: CertificateTemplate) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api.delete(`/certificates/templates/${t.id}`);
      show('Template deleted', 'success');
      qc.invalidateQueries({ queryKey: ['cert-templates'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openIssue = () => {
    setIssueForm({ template_id: '', issued_to_name: '', issued_to_id: '', issued_date: new Date().toISOString().slice(0, 10), details: '' });
    setIssueOpen(true);
  };

  const issueCert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<{ certificate_number: string }>('/certificates/issued', {
        template_id: issueForm.template_id,
        issued_to_name: issueForm.issued_to_name,
        issued_to_id: issueForm.issued_to_id || null,
        issued_date: issueForm.issued_date,
        details: issueForm.details || null,
      });
      show(`Issued ${r.certificate_number}`, 'success');
      setIssueOpen(false);
      qc.invalidateQueries({ queryKey: ['cert-issued'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Certificates"
        description="Templates and issued certificates"
        actions={
          canWrite && (
            <>
              <Button variant="secondary" onClick={() => openTpl()}><Plus className="w-4 h-4" /> Template</Button>
              <Button onClick={openIssue}><Plus className="w-4 h-4" /> Issue Certificate</Button>
            </>
          )
        }
      />

      <div className="border-b border-slate-200 mb-4">
        <nav className="flex gap-1">
          <button
            onClick={() => setTab('issued')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'issued' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            Issued ({issued.items.length})
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'templates' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
          >
            Templates ({tpls.items.length})
          </button>
        </nav>
      </div>

      {tab === 'issued' && (
        <Card>
          {iLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (issued.items.length === 0) ? (
            <EmptyState
              title="No certificates issued"
              description="Issue a certificate to track it here."
            />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Cert #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Issued To</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Template</th>
                </tr>
              </thead>
              <tbody>
                {issued.items.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono">{c.certificate_number}</td>
                    <td className="px-4 py-3"><Badge variant="info">{c.certificate_type}</Badge></td>
                    <td className="px-4 py-3 text-sm font-medium">{c.issued_to_name}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(c.issued_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.template_name}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'templates' && (
        <Card>
          {tpls.items.length === 0 ? (
            <EmptyState
              title="No templates"
              description="Create a certificate template to begin."
            />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {tpls.items.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                    <td className="px-4 py-3"><Badge variant="info">{t.certificate_type}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={t.status === 'active' ? 'success' : 'default'}>{t.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {canWrite && (
                        <button onClick={() => openTpl(t)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => removeTpl(t)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
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

      <Modal open={tplOpen} onClose={() => setTplOpen(false)} title={editingTpl ? 'Edit Template' : 'New Template'} size="lg">
        <form onSubmit={saveTpl} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required>
              <Input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} required maxLength={120} />
            </FormField>
            <FormField label="Type" required>
              <Select value={tplForm.certificate_type} onChange={(e) => {
                const t = e.target.value as CertificateTemplate['certificate_type'];
                setTplForm({
                  ...tplForm, certificate_type: t,
                  template_html: t === 'transfer' ? DEFAULT_TRANSFER : (t === 'bonafide' ? DEFAULT_BONAFIDE : tplForm.template_html),
                });
              }}>
                <option value="bonafide">Bonafide</option>
                <option value="transfer">Transfer</option>
                <option value="character">Character</option>
                <option value="achievement">Achievement</option>
                <option value="completion">Completion</option>
                <option value="custom">Custom</option>
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={tplForm.status} onChange={(e) => setTplForm({ ...tplForm, status: e.target.value as CertificateTemplate['status'] })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Template HTML" hint="Use {{placeholders}} like {{name}}, {{admission_no}}, etc.">
            <Textarea value={tplForm.template_html} onChange={(e) => setTplForm({ ...tplForm, template_html: e.target.value })} rows={12} className="font-mono text-xs" required />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setTplOpen(false)}>Cancel</Button>
            <Button type="submit">{editingTpl ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Issue Certificate">
        <form onSubmit={issueCert} className="space-y-3">
          <FormField label="Template" required>
            <Select value={issueForm.template_id} onChange={(e) => setIssueForm({ ...issueForm, template_id: e.target.value })} required>
              <option value="">Select template...</option>
              {tpls.items.filter((t) => t.status === 'active').map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.certificate_type})</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Issued To (Name)" required>
            <Input value={issueForm.issued_to_name} onChange={(e) => setIssueForm({ ...issueForm, issued_to_name: e.target.value })} required maxLength={160} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Issued Date" required>
              <Input type="date" value={issueForm.issued_date} onChange={(e) => setIssueForm({ ...issueForm, issued_date: e.target.value })} required />
            </FormField>
            <FormField label="Reference ID" hint="Student/Staff ID (optional)">
              <Input value={issueForm.issued_to_id} onChange={(e) => setIssueForm({ ...issueForm, issued_to_id: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Details">
            <Textarea value={issueForm.details} onChange={(e) => setIssueForm({ ...issueForm, details: e.target.value })} rows={2} maxLength={2000} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button type="submit">Issue</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}