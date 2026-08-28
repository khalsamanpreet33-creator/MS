import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle, XCircle, Clock, FileText, UserCheck, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface Inquiry {
  id: string;
  name: string;
  parent_name: string | null;
  phone: string | null;
  email: string | null;
  applying_for_class_id: string | null;
  applying_for_class_name: string | null;
  source: string | null;
  status: 'new' | 'contacted' | 'reviewing' | 'accepted' | 'rejected' | 'waitlisted' | 'enrolled';
  notes: string | null;
  converted_student_id: string | null;
  has_application: number;
  created_at: string;
}

interface Application {
  id: string;
  inquiry_id: string;
  dob: string | null;
  gender: string | null;
  address: string | null;
  previous_school: string | null;
  documents_checklist: string | null;
  test_score: number | null;
  test_date: string | null;
  interview_notes: string | null;
  decision_date: string | null;
}

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; class_id: string; }

const STATUS_BADGE: Record<Inquiry['status'], 'warning' | 'info' | 'success' | 'danger' | 'default'> = {
  new: 'warning', contacted: 'info', reviewing: 'info', accepted: 'success',
  rejected: 'danger', waitlisted: 'default', enrolled: 'success',
};

const PIPELINE: Inquiry['status'][] = ['new', 'contacted', 'reviewing', 'accepted', 'rejected', 'waitlisted', 'enrolled'];

export default function Admissions() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('admissions.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('admissions.delete'));
  const { show, node } = useToasts();

  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [filter, setFilter] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '', parent_name: '', phone: '', email: '',
    applying_for_class_id: '', source: 'walk-in', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [appOpen, setAppOpen] = useState<string | null>(null);
  const [appForm, setAppForm] = useState({
    dob: '', gender: '', address: '', previous_school: '',
    documents_checklist: '', test_score: '', test_date: '', interview_notes: '',
  });

  const [convertOpen, setConvertOpen] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState({ admission_no: '', first_name: '', last_name: '', section_id: '' });

  const { data, isLoading } = useQuery<{ items: Inquiry[] }>({
    queryKey: ['admissions-inquiries', filter],
    queryFn: () => api.get(`/admissions/inquiries?status=${filter}`),
  });

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data: appDetail, refetch: refetchApp } = useQuery<Inquiry & { application: Application | null }>({
    queryKey: ['admission-inquiry', appOpen],
    queryFn: () => api.get(`/admissions/inquiries/${appOpen}`),
    enabled: !!appOpen,
  });

  const { data: sections = [] } = useQuery<SectionItem[]>({
    queryKey: ['class-sections', appDetail?.applying_for_class_id],
    queryFn: () => api.get(`/classes/${appDetail?.applying_for_class_id}/sections`).then((r: { items: SectionItem[] }) => r.items),
    enabled: !!appDetail?.applying_for_class_id,
  });

  const createInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admissions/inquiries', {
        ...newForm,
        parent_name: newForm.parent_name || null,
        phone: newForm.phone || null,
        email: newForm.email || null,
        applying_for_class_id: newForm.applying_for_class_id || null,
        source: newForm.source || null,
        notes: newForm.notes || null,
      });
      show('Inquiry created', 'success');
      setNewOpen(false);
      setNewForm({ name: '', parent_name: '', phone: '', email: '', applying_for_class_id: '', source: 'walk-in', notes: '' });
      qc.invalidateQueries({ queryKey: ['admissions-inquiries'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: Inquiry['status']) => {
    try {
      await api.patch(`/admissions/inquiries/${id}`, { status });
      qc.invalidateQueries({ queryKey: ['admissions-inquiries'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const deleteInquiry = async (id: string, name: string) => {
    if (!confirm(`Delete inquiry "${name}"?`)) return;
    try {
      await api.delete(`/admissions/inquiries/${id}`);
      show('Inquiry deleted', 'success');
      qc.invalidateQueries({ queryKey: ['admissions-inquiries'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openApp = (id: string) => {
    setAppOpen(id);
    refetchApp();
    setAppForm({ dob: '', gender: '', address: '', previous_school: '', documents_checklist: '', test_score: '', test_date: '', interview_notes: '' });
  };

  useEffect(() => {
    if (appDetail?.application) {
      const a = appDetail.application;
      setAppForm({
        dob: a.dob ?? '', gender: a.gender ?? '', address: a.address ?? '',
        previous_school: a.previous_school ?? '', documents_checklist: a.documents_checklist ?? '',
        test_score: a.test_score !== null ? String(a.test_score) : '',
        test_date: a.test_date ?? '', interview_notes: a.interview_notes ?? '',
      });
    }
  }, [appDetail?.id, appDetail?.application]);

  const saveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appOpen) return;
    try {
      await api.put(`/admissions/applications/${appOpen}`, {
        dob: appForm.dob || null,
        gender: appForm.gender || null,
        address: appForm.address || null,
        previous_school: appForm.previous_school || null,
        documents_checklist: appForm.documents_checklist || null,
        test_score: appForm.test_score ? Number(appForm.test_score) : null,
        test_date: appForm.test_date || null,
        interview_notes: appForm.interview_notes || null,
      });
      show('Application saved', 'success');
      qc.invalidateQueries({ queryKey: ['admission-inquiry', appOpen] });
      qc.invalidateQueries({ queryKey: ['admissions-inquiries'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const decide = async (status: 'accepted' | 'rejected' | 'waitlisted') => {
    if (!appOpen) return;
    try {
      await api.patch(`/admissions/applications/${appOpen}/decision`, { status });
      show(`Application ${status}`, 'success');
      qc.invalidateQueries({ queryKey: ['admission-inquiry', appOpen] });
      qc.invalidateQueries({ queryKey: ['admissions-inquiries'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openConvert = (inq: Inquiry) => {
    setConvertOpen(inq.id);
    const parts = inq.name.trim().split(/\s+/);
    setConvertForm({
      admission_no: `ADM-${Date.now().toString().slice(-6)}`,
      first_name: parts[0] ?? '',
      last_name: parts.slice(1).join(' ') || '-',
      section_id: '',
    });
  };

  const convert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertOpen) return;
    try {
      await api.post(`/admissions/inquiries/${convertOpen}/convert`, {
        ...convertForm,
        section_id: convertForm.section_id || null,
      });
      show('Converted to student', 'success');
      setConvertOpen(null);
      qc.invalidateQueries({ queryKey: ['admissions-inquiries'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Admissions"
        description={`${data?.items.length ?? 0} total inquiries`}
        actions={
          canWrite && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="w-4 h-4" /> New Inquiry
            </Button>
          )
        }
      />

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setView('pipeline')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === 'pipeline' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Pipeline
        </button>
        <button
          onClick={() => setView('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          List
        </button>
      </div>

      {view === 'pipeline' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {PIPELINE.map((s) => {
                const items = (data?.items ?? []).filter((i) => i.status === s);
                return (
                  <div key={s} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={STATUS_BADGE[s]}>{s}</Badge>
                      <span className="text-xs text-slate-500">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.slice(0, 6).map((i) => (
                        <div key={i.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 cursor-pointer hover:shadow-md transition" onClick={() => openApp(i.id)}>
                          <div className="font-medium text-sm text-slate-900">{i.name}</div>
                          <div className="text-xs text-slate-500">{i.applying_for_class_name ?? '—'}</div>
                          {i.parent_name && <div className="text-xs text-slate-500 mt-1">{i.parent_name}</div>}
                          {i.phone && <div className="text-xs text-slate-400">{i.phone}</div>}
                          {i.has_application > 0 && (
                            <div className="mt-2"><Badge variant="info"><FileText className="w-3 h-3 inline" /> App</Badge></div>
                          )}
                          {i.converted_student_id && (
                            <div className="mt-2"><Badge variant="success"><UserCheck className="w-3 h-3 inline" /> Enrolled</Badge></div>
                          )}
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="text-xs text-slate-400 text-center py-2">No items</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'list' && (
        <Card>
          <div className="p-4 border-b border-slate-100">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto">
              <option value="">All statuses</option>
              {PIPELINE.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No inquiries" description="Capture your first admission inquiry to start the pipeline." />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Applying for</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data!.items.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <button onClick={() => openApp(i.id)} className="text-blue-600 hover:underline font-medium">
                        {i.name}
                      </button>
                      {i.has_application > 0 && <span className="ml-2"><Badge variant="info">App</Badge></span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{i.parent_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{i.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{i.applying_for_class_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{i.source ?? '—'}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS_BADGE[i.status]}>{i.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(i.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {canDelete && (
                        <button onClick={() => deleteInquiry(i.id, i.name)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
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

      {/* New inquiry modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Inquiry">
        <form onSubmit={createInquiry} className="space-y-3">
          <FormField label="Student Name" required>
            <Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Parent / Guardian">
              <Input value={newForm.parent_name} onChange={(e) => setNewForm({ ...newForm, parent_name: e.target.value })} />
            </FormField>
            <FormField label="Phone">
              <Input value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} />
            </FormField>
            <FormField label="Source">
              <Select value={newForm.source} onChange={(e) => setNewForm({ ...newForm, source: e.target.value })}>
                <option value="walk-in">Walk-in</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="advertisement">Advertisement</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Applying for Class">
            <Select value={newForm.applying_for_class_id} onChange={(e) => setNewForm({ ...newForm, applying_for_class_id: e.target.value })}>
              <option value="">Select class...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Notes">
            <Textarea value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} rows={2} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Inquiry'}</Button>
          </div>
        </form>
      </Modal>

      {/* Application/Detail modal */}
      <Modal open={!!appOpen} onClose={() => setAppOpen(null)} title={appDetail?.name ?? 'Application'} size="xl">
        {appDetail && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">Applying for: {appDetail.applying_for_class_name ?? '—'}</div>
                <div className="text-sm text-slate-500">Parent: {appDetail.parent_name ?? '—'} · {appDetail.phone ?? '—'}</div>
                <div className="text-sm text-slate-500">Email: {appDetail.email ?? '—'}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={STATUS_BADGE[appDetail.status]}>{appDetail.status}</Badge>
                <Select
                  value={appDetail.status}
                  onChange={(e) => updateStatus(appDetail.id, e.target.value as Inquiry['status'])}
                  className="w-auto text-xs"
                >
                  {PIPELINE.filter((s) => s !== appDetail.status).map((s) => (
                    <option key={s} value={s}>Move to {s}</option>
                  ))}
                </Select>
              </div>
            </div>

            <form onSubmit={saveApplication} className="border-t border-slate-100 pt-4 space-y-3">
              <div className="text-sm font-semibold text-slate-700">Application Details</div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Date of Birth">
                  <Input type="date" value={appForm.dob} onChange={(e) => setAppForm({ ...appForm, dob: e.target.value })} />
                </FormField>
                <FormField label="Gender">
                  <Select value={appForm.gender} onChange={(e) => setAppForm({ ...appForm, gender: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
                <FormField label="Previous School">
                  <Input value={appForm.previous_school} onChange={(e) => setAppForm({ ...appForm, previous_school: e.target.value })} />
                </FormField>
                <FormField label="Test Score">
                  <Input type="number" min={0} value={appForm.test_score} onChange={(e) => setAppForm({ ...appForm, test_score: e.target.value })} />
                </FormField>
                <FormField label="Test Date">
                  <Input type="date" value={appForm.test_date} onChange={(e) => setAppForm({ ...appForm, test_date: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Address">
                <Textarea value={appForm.address} onChange={(e) => setAppForm({ ...appForm, address: e.target.value })} rows={2} />
              </FormField>
              <FormField label="Documents Checklist" hint="e.g. Birth certificate ✓, Aadhaar ✓, Transfer cert ☐">
                <Textarea value={appForm.documents_checklist} onChange={(e) => setAppForm({ ...appForm, documents_checklist: e.target.value })} rows={2} />
              </FormField>
              <FormField label="Interview Notes">
                <Textarea value={appForm.interview_notes} onChange={(e) => setAppForm({ ...appForm, interview_notes: e.target.value })} rows={2} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="submit">Save Application</Button>
              </div>
            </form>

            <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2 justify-between">
              {canWrite && appDetail.status !== 'enrolled' && appDetail.status !== 'accepted' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => decide('accepted')}>
                    <CheckCircle className="w-4 h-4 text-emerald-700" /> Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => decide('waitlisted')}>
                    <Clock className="w-4 h-4" /> Waitlist
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide('rejected')}>
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              )}
              {canWrite && appDetail.status === 'accepted' && (
                <Button size="sm" onClick={() => openConvert(appDetail)}>
                  <UserCheck className="w-4 h-4" /> Convert to Student
                </Button>
              )}
              {appDetail.converted_student_id && (
                <div className="text-xs text-emerald-700 flex items-center gap-1">
                  <UserCheck className="w-4 h-4" /> Already enrolled
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Convert modal */}
      <Modal open={!!convertOpen} onClose={() => setConvertOpen(null)} title="Convert to Student">
        <form onSubmit={convert} className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-700 flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>This will create an active student record linked to this inquiry.</div>
          </div>
          <FormField label="Admission Number" required>
            <Input value={convertForm.admission_no} onChange={(e) => setConvertForm({ ...convertForm, admission_no: e.target.value })} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name" required>
              <Input value={convertForm.first_name} onChange={(e) => setConvertForm({ ...convertForm, first_name: e.target.value })} required />
            </FormField>
            <FormField label="Last Name" required>
              <Input value={convertForm.last_name} onChange={(e) => setConvertForm({ ...convertForm, last_name: e.target.value })} required />
            </FormField>
          </div>
          <FormField label="Section (optional)">
            <Select value={convertForm.section_id} onChange={(e) => setConvertForm({ ...convertForm, section_id: e.target.value })}>
              <option value="">No section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setConvertOpen(null)}>Cancel</Button>
            <Button type="submit">Convert</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// (state hook already imported above)
