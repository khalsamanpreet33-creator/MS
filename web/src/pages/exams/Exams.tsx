import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Award, FileText, Edit3, BarChart3 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate } from '../../lib/format';

interface Term {
  id: string;
  name: string;
  academic_year: string;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'inactive';
  exam_count: number;
}

interface Exam {
  id: string;
  term_id: string;
  term_name: string;
  academic_year: string;
  name: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  exam_date: string | null;
  max_marks: number;
  passing_marks: number;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  marks_entered: number;
  total_students: number;
}

interface ClassItem { id: string; name: string; }
interface Subject { id: string; name: string; code: string; class_id: string; }

interface GradeScale {
  id: string;
  min_percent: number;
  max_percent: number;
  grade: string;
  gpa: number;
  description: string | null;
}

interface MarkEntry {
  student_id: string;
  admission_no: string;
  name: string;
  marks_obtained: number | null;
  is_absent: boolean;
  remarks: string | null;
  percent: number | null;
  grade: string | null;
  pass: boolean;
}

const STATUS_BADGE: Record<Exam['status'], 'warning' | 'info' | 'success' | 'default'> = {
  scheduled: 'info', ongoing: 'warning', completed: 'success', cancelled: 'default',
};

export default function Exams() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('exams.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('exams.delete'));
  const { show, node } = useToasts();

  const [tab, setTab] = useState<'terms' | 'exams' | 'grades' | 'marks'>('terms');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');

  const [termOpen, setTermOpen] = useState(false);
  const [termForm, setTermForm] = useState({ name: '', academic_year: '2026-2027', start_date: '', end_date: '' });

  const [examOpen, setExamOpen] = useState(false);
  const [examForm, setExamForm] = useState({
    term_id: '', name: '', class_id: '', subject_id: '',
    exam_date: '', max_marks: 100, passing_marks: 35,
  });

  const [marksExamId, setMarksExamId] = useState<string | null>(null);
  const [marksDraft, setMarksDraft] = useState<Record<string, { marks_obtained: string; is_absent: boolean; remarks: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  const { data: terms } = useQuery<{ items: Term[] }>({
    queryKey: ['exam-terms'],
    queryFn: () => api.get('/exams/terms'),
  });

  const { data: exams, isLoading: examsLoading } = useQuery<{ items: Exam[] }>({
    queryKey: ['exams', filterTerm, filterClass],
    queryFn: () => api.get(`/exams?termId=${filterTerm}&classId=${filterClass}`),
    enabled: tab === 'exams' || tab === 'marks',
  });

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects-list'],
    queryFn: () => api.get('/subjects').then((r: { items: Subject[] }) => r.items),
  });

  const { data: grades } = useQuery<{ items: GradeScale[] }>({
    queryKey: ['grade-scales'],
    queryFn: () => api.get('/exams/grade-scales'),
  });

  const { data: marksData } = useQuery<{ exam: Record<string, unknown>; marks: MarkEntry[] }>({
    queryKey: ['exam-marks', marksExamId],
    queryFn: () => api.get(`/exams/${marksExamId}/marks`),
    enabled: !!marksExamId && tab === 'marks',
  });

  const createTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/exams/terms', {
        ...termForm,
        start_date: termForm.start_date || null,
        end_date: termForm.end_date || null,
      });
      show('Term created', 'success');
      setTermOpen(false);
      setTermForm({ name: '', academic_year: '2026-2027', start_date: '', end_date: '' });
      qc.invalidateQueries({ queryKey: ['exam-terms'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const deleteTerm = async (id: string, name: string) => {
    if (!confirm(`Delete term "${name}"? All exams in this term will also be deleted.`)) return;
    try {
      await api.delete(`/exams/terms/${id}`);
      show('Term deleted', 'success');
      qc.invalidateQueries({ queryKey: ['exam-terms'] });
      qc.invalidateQueries({ queryKey: ['exams'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/exams', {
        ...examForm,
        exam_date: examForm.exam_date || null,
      });
      show('Exam created', 'success');
      setExamOpen(false);
      setExamForm({ term_id: '', name: '', class_id: '', subject_id: '', exam_date: '', max_marks: 100, passing_marks: 35 });
      qc.invalidateQueries({ queryKey: ['exams'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const deleteExam = async (id: string, name: string) => {
    if (!confirm(`Delete exam "${name}"?`)) return;
    try {
      await api.delete(`/exams/${id}`);
      show('Exam deleted', 'success');
      qc.invalidateQueries({ queryKey: ['exams'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openMarks = (examId: string) => {
    setMarksExamId(examId);
    setMarksDraft({});
    setTab('marks');
  };

  const updateMark = (studentId: string, field: 'marks_obtained' | 'is_absent' | 'remarks', value: string | boolean) => {
    setMarksDraft((prev) => ({
      ...prev,
      [studentId]: {
        marks_obtained: prev[studentId]?.marks_obtained ?? '',
        is_absent: prev[studentId]?.is_absent ?? false,
        remarks: prev[studentId]?.remarks ?? '',
        [field]: value,
      },
    }));
  };

  const saveMarks = async () => {
    if (!marksExamId || !marksData) return;
    setSavingMarks(true);
    try {
      const entries = marksData.marks.map((m) => {
        const draft = marksDraft[m.student_id];
        const value = draft?.marks_obtained ?? (m.marks_obtained !== null ? String(m.marks_obtained) : '');
        const isAbsent = draft?.is_absent ?? !!m.is_absent;
        return {
          student_id: m.student_id,
          marks_obtained: value === '' ? null : Number(value),
          is_absent: isAbsent,
          remarks: draft?.remarks ?? m.remarks ?? null,
        };
      });
      await api.post(`/exams/${marksExamId}/marks`, { entries });
      show('Marks saved', 'success');
      setMarksDraft({});
      qc.invalidateQueries({ queryKey: ['exam-marks', marksExamId] });
      qc.invalidateQueries({ queryKey: ['exams'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
    finally { setSavingMarks(false); }
  };

  const subjectsForClass = examForm.class_id
    ? subjects.filter((s) => s.class_id === examForm.class_id)
    : [];

  return (
    <div>
      {node}
      <PageHeader
        title="Exams & Results"
        actions={
          <div className="flex gap-2">
            {canWrite && tab === 'terms' && (
              <Button onClick={() => setTermOpen(true)}>
                <Plus className="w-4 h-4" /> New Term
              </Button>
            )}
            {canWrite && tab === 'exams' && (
              <Button onClick={() => setExamOpen(true)}>
                <Plus className="w-4 h-4" /> New Exam
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['terms', 'exams', 'marks', 'grades'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1 capitalize ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t === 'terms' && <FileText className="w-4 h-4" />}
            {t === 'exams' && <Edit3 className="w-4 h-4" />}
            {t === 'marks' && <BarChart3 className="w-4 h-4" />}
            {t === 'grades' && <Award className="w-4 h-4" />}
            {t === 'terms' ? 'Terms' : t === 'exams' ? 'Exams' : t === 'marks' ? 'Marks Entry' : 'Grade Scales'}
          </button>
        ))}
      </div>

      {tab === 'terms' && (
        <Card>
          {(terms?.items.length ?? 0) === 0 ? (
            <EmptyState title="No exam terms" description="Create a term to schedule exams." />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Academic Year</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Exams</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {terms!.items.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{t.academic_year}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(t.start_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(t.end_date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{t.exam_count}</td>
                    <td className="px-4 py-3"><Badge variant={t.status === 'active' ? 'success' : 'default'}>{t.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {canDelete && (
                        <button onClick={() => deleteTerm(t.id, t.name)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
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

      {tab === 'exams' && (
        <>
          <Card className="p-4 mb-4">
            <div className="flex flex-wrap gap-2">
              <Select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)} className="w-auto">
                <option value="">All terms</option>
                {terms?.items.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>
                ))}
              </Select>
              <Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="w-auto">
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </Card>
          <Card>
            {examsLoading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : (exams?.items.length ?? 0) === 0 ? (
              <EmptyState title="No exams" description="Create exams to schedule assessments." />
            ) : (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Term</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Max</th>
                    <th className="px-4 py-3">Pass</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {exams!.items.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{e.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{e.term_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{e.class_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{e.subject_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(e.exam_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{e.max_marks}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{e.passing_marks}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${e.total_students > 0 ? (e.marks_entered / e.total_students) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{e.marks_entered}/{e.total_students}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge variant={STATUS_BADGE[e.status]}>{e.status}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && (
                          <button
                            onClick={() => openMarks(e.id)}
                            className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs mr-1"
                          >
                            Enter Marks
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => deleteExam(e.id, e.name)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
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
        </>
      )}

      {tab === 'marks' && (
        <>
          <Card className="p-4 mb-4">
            <Select
              value={marksExamId ?? ''}
              onChange={(e) => { setMarksExamId(e.target.value); setMarksDraft({}); }}
              className="max-w-md"
            >
              <option value="">Select an exam...</option>
              {exams?.items.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} - {e.class_name} - {e.subject_name} ({e.term_name})
                </option>
              ))}
            </Select>
          </Card>

          {marksExamId && marksData && (
            <>
              <Card className="p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{(marksData.exam as { name: string }).name}</div>
                    <div className="text-sm text-slate-500">
                      {(marksData.exam as { class_name: string }).class_name} · {(marksData.exam as { subject_name: string }).subject_name}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    Max: {(marksData.exam as { max_marks: number }).max_marks} · Pass: {(marksData.exam as { passing_marks: number }).passing_marks}
                  </div>
                  {canWrite && (
                    <Button onClick={saveMarks} disabled={savingMarks}>
                      <Save className="w-4 h-4" /> {savingMarks ? 'Saving...' : 'Save Marks'}
                    </Button>
                  )}
                </div>
              </Card>

              <Card>
                <Table>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-3">Adm #</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3 w-32">Marks</th>
                      <th className="px-4 py-3">Absent</th>
                      <th className="px-4 py-3">Remarks</th>
                      <th className="px-4 py-3">%</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksData.marks.map((m) => {
                      const draft = marksDraft[m.student_id];
                      const value = draft?.marks_obtained ?? (m.marks_obtained !== null ? String(m.marks_obtained) : '');
                      const isAbsent = draft?.is_absent ?? !!m.is_absent;
                      const max = (marksData.exam as { max_marks: number }).max_marks;
                      const num = value === '' ? null : Number(value);
                      const percent = num !== null && max > 0 ? Math.round((num / max) * 10000) / 100 : null;
                      return (
                        <tr key={m.student_id} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-xs text-slate-500">{m.admission_no}</td>
                          <td className="px-4 py-2 text-sm text-slate-900">{m.name}</td>
                          <td className="px-4 py-2">
                            <Input
                              type="number" min={0} max={max} step="0.01"
                              value={value}
                              disabled={isAbsent}
                              onChange={(e) => updateMark(m.student_id, 'marks_obtained', e.target.value)}
                              className="w-24"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={isAbsent}
                              onChange={(e) => updateMark(m.student_id, 'is_absent', e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={draft?.remarks ?? m.remarks ?? ''}
                              onChange={(e) => updateMark(m.student_id, 'remarks', e.target.value)}
                              className="w-40"
                              placeholder="Optional"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-700">{percent ?? '—'}</td>
                          <td className="px-4 py-2 text-sm font-medium text-slate-900">{m.grade ?? '—'}</td>
                          <td className="px-4 py-2">
                            {isAbsent ? <Badge variant="default">Absent</Badge>
                              : m.pass ? <Badge variant="success">Pass</Badge>
                              : <Badge variant="danger">Fail</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}

      {tab === 'grades' && (
        <Card>
          {(grades?.items.length ?? 0) === 0 ? (
            <EmptyState title="No grade scales" />
          ) : (
            <Table>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Min %</th>
                  <th className="px-4 py-3">Max %</th>
                  <th className="px-4 py-3">GPA</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {grades!.items.map((g) => (
                  <tr key={g.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{g.grade}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{g.min_percent}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{g.max_percent}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{g.gpa}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{g.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Term modal */}
      <Modal open={termOpen} onClose={() => setTermOpen(false)} title="New Exam Term">
        <form onSubmit={createTerm} className="space-y-3">
          <FormField label="Name" required>
            <Input value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} required placeholder="e.g. Mid-Term 2026" />
          </FormField>
          <FormField label="Academic Year" required>
            <Input value={termForm.academic_year} onChange={(e) => setTermForm({ ...termForm, academic_year: e.target.value })} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date">
              <Input type="date" value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} />
            </FormField>
            <FormField label="End Date">
              <Input type="date" value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setTermOpen(false)}>Cancel</Button>
            <Button type="submit">Create Term</Button>
          </div>
        </form>
      </Modal>

      {/* Exam modal */}
      <Modal open={examOpen} onClose={() => setExamOpen(false)} title="New Exam" size="lg">
        <form onSubmit={createExam} className="space-y-3">
          <FormField label="Term" required>
            <Select value={examForm.term_id} onChange={(e) => setExamForm({ ...examForm, term_id: e.target.value })} required>
              <option value="">Select term...</option>
              {terms?.items.filter((t) => t.status === 'active').map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.academic_year})</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Name" required>
            <Input value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} required placeholder="e.g. Unit Test 1" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Class" required>
              <Select value={examForm.class_id} onChange={(e) => setExamForm({ ...examForm, class_id: e.target.value, subject_id: '' })} required>
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Subject" required>
              <Select value={examForm.subject_id} onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })} required disabled={!examForm.class_id}>
                <option value="">Select subject...</option>
                {subjectsForClass.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Exam Date">
              <Input type="date" value={examForm.exam_date} onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })} />
            </FormField>
            <FormField label="Max Marks" required>
              <Input type="number" min={0} value={examForm.max_marks} onChange={(e) => setExamForm({ ...examForm, max_marks: Number(e.target.value) })} required />
            </FormField>
            <FormField label="Passing Marks" required>
              <Input type="number" min={0} value={examForm.passing_marks} onChange={(e) => setExamForm({ ...examForm, passing_marks: Number(e.target.value) })} required />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setExamOpen(false)}>Cancel</Button>
            <Button type="submit">Create Exam</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
