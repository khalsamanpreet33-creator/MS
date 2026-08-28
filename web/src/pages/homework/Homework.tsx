import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ClipboardList, Calendar, CheckCircle2, Clock, AlertCircle, Search } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface HwItem {
  id: string;
  class_id: string;
  class_name: string;
  section_id: string | null;
  section_name: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  title: string;
  description: string | null;
  assigned_date: string;
  due_date: string | null;
  attachments: string | null;
  created_by_name: string | null;
  submission_count: number;
  total_students: number;
}

interface Submission {
  id: string;
  homework_id: string;
  student_id: string;
  status: 'pending' | 'submitted' | 'late' | 'reviewed';
  submitted_at: string | null;
  remarks: string | null;
  admission_no: string;
  first_name: string;
  last_name: string;
}

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; class_id: string; }
interface Subject { id: string; name: string; code: string; class_id: string; }

const STATUS_BADGE: Record<Submission['status'], 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning', submitted: 'success', late: 'danger', reviewed: 'info',
};

export default function Homework() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('homework.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('homework.delete'));
  const { show, node } = useToasts();

  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    class_id: '', section_id: '', subject_id: '',
    title: '', description: '',
    assigned_date: new Date().toISOString().slice(0, 10),
    due_date: '', attachments: '',
  });
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: HwItem[] }>({
    queryKey: ['homework', filterClass, filterSection, filterSubject],
    queryFn: () => api.get(`/homework?classId=${filterClass}&sectionId=${filterSection}&subjectId=${filterSubject}`),
  });

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects-list'],
    queryFn: () => api.get('/subjects').then((r: { items: Subject[] }) => r.items),
  });

  const { data: sections = [] } = useQuery<SectionItem[]>({
    queryKey: ['class-sections', filterClass],
    queryFn: () => filterClass
      ? api.get(`/classes/${filterClass}/sections`).then((r: { items: SectionItem[] }) => r.items)
      : Promise.resolve([]),
    enabled: !!filterClass,
  });

  const { data: detail } = useQuery<HwItem & { submissions: Submission[] }>({
    queryKey: ['homework-detail', detailId],
    queryFn: () => api.get(`/homework/${detailId}`),
    enabled: !!detailId,
  });

  const subjectsForClass = form.class_id
    ? subjects.filter((s) => s.class_id === form.class_id)
    : [];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/homework', {
        class_id: form.class_id,
        section_id: form.section_id || null,
        subject_id: form.subject_id,
        title: form.title,
        description: form.description || null,
        assigned_date: form.assigned_date,
        due_date: form.due_date || null,
        attachments: form.attachments || null,
      });
      show('Homework created', 'success');
      setCreateOpen(false);
      setForm({
        class_id: '', section_id: '', subject_id: '',
        title: '', description: '',
        assigned_date: new Date().toISOString().slice(0, 10),
        due_date: '', attachments: '',
      });
      qc.invalidateQueries({ queryKey: ['homework'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await api.delete(`/homework/${id}`);
      show('Homework deleted', 'success');
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ['homework'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const markSubmission = async (studentId: string, status: Submission['status']) => {
    if (!detailId) return;
    try {
      await api.post(`/homework/${detailId}/submissions`, { student_id: studentId, status });
      qc.invalidateQueries({ queryKey: ['homework-detail', detailId] });
      qc.invalidateQueries({ queryKey: ['homework'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Homework"
        description={`${data?.items.length ?? 0} assignment(s)`}
        actions={
          canWrite && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> New Homework
            </Button>
          )
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <Select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setFilterSection(''); setFilterSubject(''); }} className="w-auto">
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {filterClass && (
            <Select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="w-auto">
              <option value="">All sections</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          <Select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-auto">
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : (data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No homework"
                description="Assign homework to a class to see it here."
              />
            ) : (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Submissions</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((h) => (
                    <tr
                      key={h.id}
                      className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${
                        detailId === h.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setDetailId(h.id)}
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">{h.title}</div>
                        {h.description && <div className="text-xs text-slate-500 line-clamp-1">{h.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {h.class_name}{h.section_name ? ` / ${h.section_name}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="info">{h.subject_code}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(h.assigned_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(h.due_date)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden w-16">
                            <div className="h-full bg-blue-500" style={{ width: `${h.total_students > 0 ? (h.submission_count / h.total_students) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{h.submission_count}/{h.total_students}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canDelete && (
                          <button onClick={() => remove(h.id, h.title)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
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
        </div>

        <div className="lg:col-span-1">
          {detail ? (
            <Card className="p-5 sticky top-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-900">{detail.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {detail.class_name}{detail.section_name ? ` / ${detail.section_name}` : ''} · {detail.subject_name}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Assigned {formatDate(detail.assigned_date)}</span>
                {detail.due_date && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Due {formatDate(detail.due_date)}</span>}
              </div>
              {detail.description && (
                <div className="bg-slate-50 rounded p-3 my-3 text-sm text-slate-700 whitespace-pre-wrap">{detail.description}</div>
              )}
              {detail.attachments && (
                <div className="text-xs text-blue-600 mb-3 truncate">{detail.attachments}</div>
              )}
              <div className="text-xs text-slate-500 mb-3">By {detail.created_by_name ?? '—'}</div>

              <div className="border-t border-slate-100 pt-3">
                <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Submissions ({detail.submissions.length}/{detail.total_students})
                </div>
                {detail.submissions.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">No submissions yet.</div>
                ) : (
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {detail.submissions.map((s) => (
                      <div key={s.id} className="py-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-900 truncate">{s.first_name} {s.last_name}</div>
                          <div className="text-xs text-slate-500">{s.admission_no}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <>
                              {s.status !== 'submitted' && (
                                <button
                                  onClick={() => markSubmission(s.student_id, 'submitted')}
                                  className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"
                                  title="Mark submitted"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              {s.status !== 'late' && (
                                <button
                                  onClick={() => markSubmission(s.student_id, 'late')}
                                  className="text-red-600 hover:bg-red-50 p-1 rounded"
                                  title="Mark late"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                          <Badge variant={STATUS_BADGE[s.status]}>{s.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-400 text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Select a homework to view submissions.
            </Card>
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Homework" size="lg">
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Class" required>
              <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: '', section_id: '' })} required>
                <option value="">Select class...</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Subject" required>
              <Select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required disabled={!form.class_id}>
                <option value="">Select subject...</option>
                {subjectsForClass.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Section (optional)" hint="Leave blank for entire class">
              <Select value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} disabled={!form.class_id}>
                <option value="">All sections</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <div />
            <FormField label="Assigned Date" required>
              <Input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} required />
            </FormField>
            <FormField label="Due Date">
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} placeholder="e.g. Chapter 5 exercises 1-10" />
          </FormField>
          <FormField label="Description / Instructions">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          </FormField>
          <FormField label="Attachments" hint="URL or reference path">
            <Input value={form.attachments} onChange={(e) => setForm({ ...form, attachments: e.target.value })} placeholder="https://..." />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
