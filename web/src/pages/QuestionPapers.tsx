import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError, downloadFile } from '../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Modal, FormField, Textarea,
  Badge, EmptyState, useToasts,
} from '../components/ui';
import { useAuthStore } from '../store/auth';

interface SubjectOpt { id: string; name: string; code: string; class_name: string }

interface Question {
  id: string;
  subject_id: string;
  question_type: 'mcq' | 'short' | 'long' | 'numerical';
  difficulty: 'easy' | 'medium' | 'hard';
  question_text: string;
  options: string[] | null;
  marks: number;
  correct_answer: string | null;
}

interface Paper {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  title: string;
  instructions: string | null;
  duration_minutes: number | null;
  status: 'draft' | 'finalized';
  item_count: number;
  total_marks: number;
}

interface PaperItem extends Question {
  sort_order: number;
  marks_override: number | null;
}

type Tab = 'bank' | 'papers';

export default function QuestionPapers() {
  const canWrite = useAuthStore((s) => s.hasPerm('exams.write'));
  const [tab, setTab] = useState<Tab>('bank');

  const { data: subjects = [] } = useQuery<SubjectOpt[]>({
    queryKey: ['subjects-with-class'],
    queryFn: () => api.get<{ items: SubjectOpt[] }>('/subjects').then((r) => r.items),
  });
  const [subjectId, setSubjectId] = useState<string>('');

  return (
    <div>
      <PageHeader
        title="Question Papers"
        description="Question bank and paper composition"
      />

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['bank', 'papers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t === 'bank' ? 'Question bank' : 'Papers'}
          </button>
        ))}
      </div>

      <div className="mb-4 max-w-sm">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.class_name})</option>
          ))}
        </Select>
      </div>

      {tab === 'bank' && <BankTab subjectId={subjectId} canWrite={canWrite} />}
      {tab === 'papers' && <PapersTab subjectId={subjectId} canWrite={canWrite} />}
    </div>
  );
}

function BankTab({ subjectId, canWrite }: { subjectId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    question_type: 'short' as Question['question_type'],
    difficulty: 'medium' as Question['difficulty'],
    question_text: '',
    marks: 1,
    options: ['', '', '', ''],
    correct_answer: '',
  });

  const { data: questions = [] } = useQuery<Question[]>({
    queryKey: ['questions', subjectId],
    queryFn: () => {
      const q = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : '';
      return api.get<{ items: Question[] }>(`/question-bank${q}`).then((r) => r.items);
    },
    enabled: !!subjectId,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      show('Pick a subject first', 'error');
      return;
    }
    try {
      const payload = {
        subject_id: subjectId,
        question_type: form.question_type,
        difficulty: form.difficulty,
        question_text: form.question_text,
        marks: form.marks,
        correct_answer: form.correct_answer || null,
        options_json: form.question_type === 'mcq'
          ? JSON.stringify(form.options.filter((o) => o.trim()))
          : null,
      };
      await api.post('/question-bank', payload);
      show('Question added', 'success');
      setAdding(false);
      setForm({ ...form, question_text: '', correct_answer: '', options: ['', '', '', ''] });
      qc.invalidateQueries({ queryKey: ['questions'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const remove = async (q: Question) => {
    if (!confirm(`Remove question "${q.question_text.slice(0, 50)}…"?`)) return;
    try {
      await api.delete(`/question-bank/${q.id}`);
      qc.invalidateQueries({ queryKey: ['questions'] });
      show('Question removed', 'success');
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      {!subjectId ? (
        <EmptyState title="Pick a subject" description="Filter the bank by selecting a subject above." />
      ) : (
        <>
          <div className="flex justify-end mb-3">
            {canWrite && <Button onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Add question</Button>}
          </div>

          {questions.length === 0 ? (
            <EmptyState title="No questions yet" description="Add one to start building papers." />
          ) : (
            <div className="space-y-2">
              {questions.map((q) => (
                <Card key={q.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="info">{q.question_type.toUpperCase()}</Badge>
                        <Badge variant="default">{q.difficulty}</Badge>
                        <span className="text-xs text-slate-500">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
                      </div>
                      <div className="text-sm text-slate-800">{q.question_text}</div>
                      {q.options && (
                        <ul className="text-xs text-slate-600 mt-1 space-y-0.5">
                          {q.options.map((o, i) => <li key={i}>{o}</li>)}
                        </ul>
                      )}
                      {q.correct_answer && (
                        <div className="text-xs text-emerald-700 mt-1">Answer: {q.correct_answer}</div>
                      )}
                    </div>
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => remove(q)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Modal open={adding} onClose={() => setAdding(false)} title="New question" size="lg">
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Type">
                  <Select value={form.question_type} onChange={(e) => setForm({ ...form, question_type: e.target.value as Question['question_type'] })}>
                    <option value="mcq">MCQ</option>
                    <option value="short">Short answer</option>
                    <option value="long">Long answer</option>
                    <option value="numerical">Numerical</option>
                  </Select>
                </FormField>
                <FormField label="Difficulty">
                  <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Question['difficulty'] })}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </FormField>
                <FormField label="Marks">
                  <Input type="number" min={1} max={100} value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} />
                </FormField>
              </div>
              <FormField label="Question text" required>
                <Textarea rows={3} value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} />
              </FormField>
              {form.question_type === 'mcq' && (
                <div className="grid grid-cols-2 gap-2">
                  {form.options.map((o, i) => (
                    <Input
                      key={i}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={o}
                      onChange={(e) => setForm({ ...form, options: form.options.map((v, j) => j === i ? e.target.value : v) })}
                    />
                  ))}
                </div>
              )}
              <FormField label="Correct answer" hint="Optional — for reference only">
                <Input value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })} />
              </FormField>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" type="button" onClick={() => setAdding(false)}>Cancel</Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}

function PapersTab({ subjectId, canWrite }: { subjectId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const { show } = useToasts();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', instructions: '', duration_minutes: 60 });
  const [activePaper, setActivePaper] = useState<Paper | null>(null);

  const { data: papers = [] } = useQuery<Paper[]>({
    queryKey: ['papers', subjectId],
    queryFn: () => {
      const q = subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : '';
      return api.get<{ items: Paper[] }>(`/question-papers${q}`).then((r) => r.items);
    },
  });

  const createPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) { show('Pick a subject first', 'error'); return; }
    try {
      const r = await api.post<Paper>('/question-papers', {
        subject_id: subjectId,
        title: form.title,
        instructions: form.instructions || null,
        duration_minutes: form.duration_minutes,
      });
      show('Paper created', 'success');
      setCreating(false);
      setForm({ title: '', instructions: '', duration_minutes: 60 });
      qc.invalidateQueries({ queryKey: ['papers'] });
      setActivePaper(r);
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        {canWrite && (
          <Button onClick={() => setCreating(true)} disabled={!subjectId}>
            <Plus className="w-4 h-4" /> New paper
          </Button>
        )}
      </div>

      {papers.length === 0 ? (
        <EmptyState
          title="No papers yet"
          description={subjectId ? 'Create a paper to start composing.' : 'Pick a subject above to see its papers.'}
        />
      ) : (
        <div className="space-y-2">
          {papers.map((p) => (
            <div
              key={p.id}
              onClick={() => setActivePaper(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActivePaper(p); }}
            >
              <Card className="p-4 hover:border-blue-300 cursor-pointer transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-slate-900">{p.title}</span>
                      <Badge variant={p.status === 'finalized' ? 'success' : 'default'}>{p.status}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {p.subject_code} · {p.class_name}
                      {p.duration_minutes && ` · ${p.duration_minutes} min`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-800">{p.item_count} question{p.item_count === 1 ? '' : 's'}</div>
                    <div className="text-xs text-slate-500">{p.total_marks} marks</div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New paper">
        <form onSubmit={createPaper} className="space-y-3">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Unit Test 1" />
          </FormField>
          <FormField label="Instructions">
            <Textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Answer all questions." />
          </FormField>
          <FormField label="Duration (minutes)">
            <Input type="number" min={1} max={600} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>

      {activePaper && (
        <PaperDetail
          paper={activePaper}
          onClose={() => { setActivePaper(null); qc.invalidateQueries({ queryKey: ['papers'] }); }}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}

function PaperDetail({ paper, onClose, canWrite }: { paper: Paper; onClose: () => void; canWrite: boolean }) {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [adding, setAdding] = useState(false);
  const [pickQ, setPickQ] = useState('');

  const { data: detail, refetch } = useQuery<Paper & { items: PaperItem[] }>({
    queryKey: ['paper', paper.id],
    queryFn: () => api.get(`/question-papers/${paper.id}`),
  });

  const { data: bank = [] } = useQuery<Question[]>({
    queryKey: ['questions', paper.subject_id],
    queryFn: () => api.get<{ items: Question[] }>(`/question-bank?subject_id=${encodeURIComponent(paper.subject_id)}`).then((r) => r.items),
    enabled: adding,
  });

  const addQuestion = async () => {
    if (!pickQ) return;
    try {
      const sortOrder = (detail?.items.length ?? 0) + 1;
      await api.post(`/question-papers/${paper.id}/items`, { question_id: pickQ, sort_order: sortOrder });
      show('Question added', 'success');
      setAdding(false);
      setPickQ('');
      refetch();
      qc.invalidateQueries({ queryKey: ['papers'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const removeItem = async (itemId: string) => {
    if (!confirm('Remove this question from the paper?')) return;
    try {
      await api.delete(`/question-papers/${paper.id}/items/${itemId}`);
      refetch();
      qc.invalidateQueries({ queryKey: ['papers'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title={detail?.title ?? paper.title} size="lg">
      {node}
      <div className="space-y-3">
        <div className="flex items-baseline gap-2 text-sm text-slate-600">
          <span>{paper.subject_code} · {paper.class_name}</span>
          {detail?.duration_minutes && <span>· {detail.duration_minutes} min</span>}
          <span className="ml-auto font-medium text-slate-800">
            {detail ? `${detail.items.length} question(s) · ${detail.total_marks} marks` : ''}
          </span>
        </div>

        {detail?.instructions && (
          <div className="text-xs italic text-slate-600 border-l-2 border-slate-200 pl-2">
            {detail.instructions}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => downloadFile(`/question-papers/${paper.id}/pdf`, `${paper.title}.pdf`)}
          >
            <Download className="w-4 h-4" /> Download PDF
          </Button>
          {canWrite && (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> Add question
            </Button>
          )}
        </div>

        {adding && (
          <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
            <FormField label="Pick a question from the bank" required>
              <Select value={pickQ} onChange={(e) => setPickQ(e.target.value)}>
                <option value="">— select —</option>
                {bank.map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.question_type}] {b.question_text.slice(0, 60)}… ({b.marks}m)
                    </option>
                  ))}
              </Select>
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setAdding(false); setPickQ(''); }}>Cancel</Button>
              <Button size="sm" onClick={addQuestion} disabled={!pickQ}>Add</Button>
            </div>
          </div>
        )}

        {detail?.items.length === 0 ? (
          <EmptyState
            title="No questions in this paper"
            description={canWrite ? 'Add some from the bank.' : 'This paper is empty.'}
          />
        ) : (
          <ol className="space-y-2">
            {detail?.items.map((it) => (
              <li key={it.id} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-slate-400 font-mono w-6 flex-none text-right pt-1">{it.sort_order}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="info">{it.question_type.toUpperCase()}</Badge>
                      <span className="text-xs text-slate-500">{it.marks_override ?? it.marks} mark{(it.marks_override ?? it.marks) === 1 ? '' : 's'}</span>
                    </div>
                    <div className="text-sm text-slate-800">{it.question_text}</div>
                    {it.options && (
                      <ul className="text-xs text-slate-600 mt-1 space-y-0.5">
                        {it.options.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    )}
                  </div>
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(it.id)} title="Remove">
                      <X className="w-4 h-4 text-slate-400" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}
