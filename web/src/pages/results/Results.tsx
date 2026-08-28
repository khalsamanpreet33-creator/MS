import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, FileText, GraduationCap } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';

interface Grade { id: string; min_percent: number; max_percent: number; grade: string; gpa: number }
interface Exam { id: string; name: string; exam_date: string; class_id: string; subject_id: string; max_marks: number; passing_marks: number; status: string }
interface Class { id: string; name: string; grade_level: number }
interface Subject { id: string; name: string; code: string }
interface Term { id: string; name: string }
interface Student { id: string; admission_no: string; first_name: string; last_name: string }
interface MarksheetItem {
  student_id: string;
  admission_no: string;
  name: string;
  marks_obtained: number | null;
  is_absent: boolean;
  percentage: number | null;
  grade: string | null;
}

type Tab = 'enter' | 'report';

export default function Results() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('results.write'));
  const { show, node } = useToasts();
  const [tab, setTab] = useState<Tab>('enter');
  const [classId, setClassId] = useState('');
  const [examId, setExamId] = useState('');

  const { data: classes = { items: [] as Class[] } } = useQuery<{ items: Class[] }>({
    queryKey: ['classes-list'], queryFn: () => api.get('/classes'),
  });
  const { data: exams = { items: [] as Exam[] } } = useQuery<{ items: Exam[] }>({
    queryKey: ['exams-list'], queryFn: () => api.get('/exams'),
  });
  const { data: subjects = { items: [] as Subject[] } } = useQuery<{ items: Subject[] }>({
    queryKey: ['subjects-list'], queryFn: () => api.get('/subjects'),
  });
  const { data: terms = { items: [] as Term[] } } = useQuery<{ items: Term[] }>({
    queryKey: ['exam-terms'], queryFn: () => api.get('/exams/terms').catch(() => ({ items: [] })),
  });

  const filteredExams = exams.items.filter((e) => !classId || e.class_id === classId);

  const { data: ms, isLoading: mLoading } = useQuery<{
    exam: Exam; items: MarksheetItem[]; stats: { total: number; entered: number; average: number; highest: number; lowest: number; pass_count: number };
  }>({
    queryKey: ['marksheet', examId, classId],
    queryFn: () => api.get(`/results/marksheet?exam_id=${examId}&class_id=${classId}`),
    enabled: !!examId && !!classId,
  });

  const [editing, setEditing] = useState<MarksheetItem | null>(null);
  const [editMarks, setEditMarks] = useState({ marks: 0, absent: false, remarks: '' });

  const openEdit = (item: MarksheetItem) => {
    setEditing(item);
    setEditMarks({ marks: item.marks_obtained ?? 0, absent: item.is_absent, remarks: '' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !ms) return;
    try {
      await api.post('/results/marks', {
        exam_id: examId,
        student_id: editing.student_id,
        marks_obtained: editMarks.absent ? null : editMarks.marks,
        is_absent: editMarks.absent,
        remarks: editMarks.remarks || null,
      });
      show('Marks saved', 'success');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['marksheet', examId, classId] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  // Report card tab
  const [reportStudent, setReportStudent] = useState('');
  const [reportTerm, setReportTerm] = useState('');
  const { data: studentsList = { items: [] as Student[] } } = useQuery<{ items: Student[] }>({
    queryKey: ['students-list'], queryFn: () => api.get('/students?limit=100'),
  });
  const { data: report } = useQuery({
    queryKey: ['report-card', reportStudent, reportTerm],
    queryFn: () => api.get(`/results/report-card?student_id=${reportStudent}&term_id=${reportTerm}`),
    enabled: !!reportStudent && !!reportTerm,
  });

  return (
    <div>
      {node}
      <PageHeader title="Results" description="Mark entry and report cards" />

      <div className="border-b border-slate-200 mb-4">
        <nav className="flex gap-1">
          <button onClick={() => setTab('enter')} className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${tab === 'enter' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
            <Save className="w-4 h-4" /> Mark Entry
          </button>
          <button onClick={() => setTab('report')} className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${tab === 'report' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
            <FileText className="w-4 h-4" /> Report Card
          </button>
        </nav>
      </div>

      {tab === 'enter' && (
        <>
          <Card className="mb-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Class">
                <Select value={classId} onChange={(e) => { setClassId(e.target.value); setExamId(''); }}>
                  <option value="">Select class...</option>
                  {classes.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Exam">
                <Select value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!classId}>
                  <option value="">Select exam...</option>
                  {filteredExams.map((e) => {
                    const subj = subjects.items.find((s) => s.id === e.subject_id);
                    return <option key={e.id} value={e.id}>{e.name} ({subj?.name ?? '—'}) — max {e.max_marks}</option>;
                  })}
                </Select>
              </FormField>
            </div>
          </Card>

          {ms && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Marksheet — {ms.exam.name}</h3>
                <div className="flex gap-3 text-xs text-slate-600">
                  <span>Avg: <strong>{ms.stats.average}</strong></span>
                  <span>High: <strong>{ms.stats.highest}</strong></span>
                  <span>Low: <strong>{ms.stats.lowest}</strong></span>
                  <span>Pass: <strong>{ms.stats.pass_count}/{ms.stats.total}</strong></span>
                </div>
              </div>
              {mLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> :
                ms.items.length === 0 ? <EmptyState title="No students" /> :
                <Table>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-3">Adm No</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Marks</th>
                      <th className="px-4 py-3">%</th>
                      <th className="px-4 py-3">Grade</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ms.items.map((it) => (
                      <tr key={it.student_id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-sm font-mono">{it.admission_no}</td>
                        <td className="px-4 py-3 text-sm font-medium">{it.name}</td>
                        <td className="px-4 py-3 text-sm">
                          {canWrite ? (
                            <button onClick={() => openEdit(it)} className="text-blue-600 hover:underline">
                              {it.is_absent ? 'A' : (it.marks_obtained ?? '—')}
                            </button>
                          ) : (it.is_absent ? 'A' : (it.marks_obtained ?? '—'))}
                        </td>
                        <td className="px-4 py-3 text-sm">{it.percentage != null ? `${it.percentage}%` : '—'}</td>
                        <td className="px-4 py-3 text-sm">{it.grade ?? '—'}</td>
                        <td className="px-4 py-3">
                          {it.is_absent ? <Badge variant="danger">Absent</Badge> :
                            it.marks_obtained == null ? <Badge>Not entered</Badge> :
                            <Badge variant={(it.marks_obtained ?? 0) >= ms.exam.passing_marks ? 'success' : 'danger'}>
                              {(it.marks_obtained ?? 0) >= ms.exam.passing_marks ? 'Pass' : 'Fail'}
                            </Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              }
            </Card>
          )}

          <Modal open={!!editing} onClose={() => setEditing(null)} title={`Marks: ${editing?.name ?? ''}`}>
            <form onSubmit={save} className="space-y-3">
              <FormField label="Absent">
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={editMarks.absent} onChange={(e) => setEditMarks({ ...editMarks, absent: e.target.checked })} />
                  <span className="text-sm">Mark student as absent</span>
                </label>
              </FormField>
              {!editMarks.absent && (
                <FormField label={`Marks obtained (max ${ms?.exam.max_marks})`}>
                  <Input type="number" min={0} max={ms?.exam.max_marks ?? 100} step="0.01" value={editMarks.marks} onChange={(e) => setEditMarks({ ...editMarks, marks: Number(e.target.value) })} required />
                </FormField>
              )}
              <FormField label="Remarks">
                <Input value={editMarks.remarks} onChange={(e) => setEditMarks({ ...editMarks, remarks: e.target.value })} maxLength={500} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {tab === 'report' && (
        <>
          <Card className="mb-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Student">
                <Select value={reportStudent} onChange={(e) => setReportStudent(e.target.value)}>
                  <option value="">Select student...</option>
                  {studentsList.items.map((s) => <option key={s.id} value={s.id}>{s.admission_no} — {s.first_name} {s.last_name}</option>)}
                </Select>
              </FormField>
              <FormField label="Term">
                <Select value={reportTerm} onChange={(e) => setReportTerm(e.target.value)}>
                  <option value="">Select term...</option>
                  {terms.items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </FormField>
            </div>
          </Card>

          {report && (
            <Card>
              <div className="border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-6 h-6 text-blue-600" />
                  <div>
                    <div className="text-lg font-semibold">{report.student.first_name} {report.student.last_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{report.student.admission_no} · {report.term.name}</div>
                  </div>
                </div>
              </div>
              {report.items.length === 0 ? <EmptyState title="No exams for this term" /> :
                <>
                  <Table>
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Exam</th>
                        <th className="px-4 py-3">Marks</th>
                        <th className="px-4 py-3">%</th>
                        <th className="px-4 py-3">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((r: any, i: number) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-sm font-medium">{r.subject_name}</td>
                          <td className="px-4 py-3 text-sm">{r.exam_name}</td>
                          <td className="px-4 py-3 text-sm">{r.is_absent ? 'A' : (r.marks_obtained != null ? `${r.marks_obtained}/${r.max_marks}` : '—')}</td>
                          <td className="px-4 py-3 text-sm">{r.percentage != null ? `${r.percentage}%` : '—'}</td>
                          <td className="px-4 py-3 text-sm">{r.grade ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  <div className="mt-4 p-4 rounded bg-blue-50 border border-blue-200 flex items-center gap-6 text-sm">
                    <div><span className="text-slate-600">Total:</span> <strong>{report.summary.total}/{report.summary.max}</strong></div>
                    <div><span className="text-slate-600">Overall:</span> <strong>{report.summary.percentage}%</strong></div>
                    <div><span className="text-slate-600">Grade:</span> <strong className="text-blue-700">{report.summary.grade}</strong></div>
                    <div><span className="text-slate-600">Subjects:</span> <strong>{report.summary.subjects}</strong></div>
                  </div>
                </>
              }
            </Card>
          )}
        </>
      )}
    </div>
  );
}
