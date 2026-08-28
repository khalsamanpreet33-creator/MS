import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen, CheckCircle2, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Modal, FormField,
  Badge, EmptyState, useToasts,
} from '../components/ui';
import { useAuthStore } from '../store/auth';

interface ClassOpt { id: string; name: string; grade_level: number }

interface Subject {
  id: string;
  class_id: string;
  class_name: string;
  code: string;
  name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  status: string;
  topic_count: number;
  completed_count: number;
}

interface Topic {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  planned_date: string | null;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  sort_order: number;
}

interface Progress {
  total: number;
  completed: number;
  in_progress: number;
  planned: number;
  skipped: number;
  completion_pct: number;
}

const STATUS_TONE = {
  planned: 'default',
  in_progress: 'info',
  completed: 'success',
  skipped: 'warning',
} as const;

export default function Academics() {
  const canWrite = useAuthStore((s) => s.hasPerm('academics.write'));
  const { data: classes = [] } = useQuery<ClassOpt[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassOpt[] }) => r.items),
  });
  const [classFilter, setClassFilter] = useState<string>('');

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects', classFilter],
    queryFn: () => {
      const q = classFilter ? `?class_id=${encodeURIComponent(classFilter)}` : '';
      return api.get<{ items: Subject[] }>(`/subjects${q}`).then((r) => r.items);
    },
  });

  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);

  return (
    <div>
      <PageHeader
        title="Subjects & Syllabus"
        description={`${subjects.length} subject(s)${classFilter ? ' in selected class' : ''}`}
        actions={canWrite && <NewSubjectButton classes={classes} />}
      />

      <div className="mb-4 max-w-xs">
        <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          title="No subjects yet"
          description={canWrite ? 'Create one to start tracking syllabus.' : 'No subjects configured for this filter.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              canWrite={canWrite}
              onOpen={() => setActiveSubject(s)}
            />
          ))}
        </div>
      )}

      {activeSubject && (
        <SubjectDrawer
          subject={subjects.find((s) => s.id === activeSubject.id) ?? activeSubject}
          canWrite={canWrite}
          onClose={() => setActiveSubject(null)}
        />
      )}
    </div>
  );
}

function SubjectCard({
  subject, canWrite, onOpen,
}: {
  subject: Subject;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const { show } = useToasts();
  const pct = subject.topic_count > 0
    ? Math.round((subject.completed_count / subject.topic_count) * 100)
    : 0;

  const remove = async () => {
    if (!confirm(`Deactivate subject "${subject.code} — ${subject.name}"?`)) return;
    try {
      await api.delete(`/subjects/${subject.id}`);
      show('Subject deactivated', 'success');
      qc.invalidateQueries({ queryKey: ['subjects'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-blue-300 cursor-pointer transition-colors"
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span className="font-mono text-xs text-slate-500">{subject.code}</span>
          </div>
          <div className="font-semibold text-slate-900 mt-1">{subject.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">{subject.class_name}</div>
        </div>
        {subject.status === 'inactive' && <Badge variant="warning">inactive</Badge>}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs text-slate-500 mb-1">
          <span>{subject.completed_count} / {subject.topic_count} topics</span>
          <span className="font-medium text-slate-700">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {subject.teacher_name && (
        <div className="text-xs text-slate-500 mt-2">Teacher: {subject.teacher_name}</div>
      )}
      {canWrite && subject.status === 'active' && (
        <div className="flex justify-end mt-3 pt-2 border-t border-slate-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); void remove(); }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Deactivate
          </Button>
        </div>
      )}
    </div>
  );
}

function NewSubjectButton({ classes }: { classes: ClassOpt[] }) {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ class_id: classes[0]?.id ?? '', code: '', name: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/subjects', form);
      show('Subject created', 'success');
      setOpen(false);
      setForm({ class_id: classes[0]?.id ?? '', code: '', name: '' });
      qc.invalidateQueries({ queryKey: ['subjects'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New subject</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New subject">
        {node}
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Class" required>
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Code" required hint="Short code, unique per class">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH" />
          </FormField>
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function SubjectDrawer({
  subject, canWrite, onClose,
}: {
  subject: Subject;
  canWrite: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [newTopic, setNewTopic] = useState({ title: '', description: '', sort_order: 1 });

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ['syllabus', subject.id],
    queryFn: () => api.get<{ items: Topic[] }>(`/syllabus/subjects/${subject.id}/topics`).then((r) => r.items),
  });

  const { data: progress } = useQuery<Progress>({
    queryKey: ['syllabus-progress', subject.id],
    queryFn: () => api.get(`/syllabus/subjects/${subject.id}/progress`),
  });

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.title.trim()) return;
    try {
      await api.post(`/syllabus/subjects/${subject.id}/topics`, {
        title: newTopic.title,
        description: newTopic.description || null,
        sort_order: newTopic.sort_order,
      });
      show('Topic added', 'success');
      setNewTopic({ title: '', description: '', sort_order: newTopic.sort_order + 1 });
      qc.invalidateQueries({ queryKey: ['syllabus', subject.id] });
      qc.invalidateQueries({ queryKey: ['syllabus-progress', subject.id] });
      qc.invalidateQueries({ queryKey: ['subjects'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const setStatus = async (t: Topic, status: Topic['status']) => {
    try {
      await api.patch(`/syllabus/topics/${t.id}`, { status });
      qc.invalidateQueries({ queryKey: ['syllabus', subject.id] });
      qc.invalidateQueries({ queryKey: ['syllabus-progress', subject.id] });
      qc.invalidateQueries({ queryKey: ['subjects'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const deleteTopic = async (t: Topic) => {
    if (!confirm(`Remove topic "${t.title}"?`)) return;
    try {
      await api.delete(`/syllabus/topics/${t.id}`);
      qc.invalidateQueries({ queryKey: ['syllabus', subject.id] });
      qc.invalidateQueries({ queryKey: ['syllabus-progress', subject.id] });
      qc.invalidateQueries({ queryKey: ['subjects'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title={`${subject.code} — ${subject.name}`} size="lg">
      {node}
      <div className="space-y-4">
        <div className="flex items-baseline gap-4 text-sm text-slate-600">
          <span>{subject.class_name}</span>
          {subject.teacher_name && <span>· Teacher: {subject.teacher_name}</span>}
          <span className="ml-auto font-medium text-slate-800">
            {progress ? `${progress.completed}/${progress.total} complete (${progress.completion_pct}%)` : ''}
          </span>
        </div>

        {canWrite && (
          <form onSubmit={addTopic} className="border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium text-slate-700">Add topic</div>
            <div className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-5"
                placeholder="Topic title"
                value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
              />
              <Input
                className="col-span-5"
                placeholder="Description (optional)"
                value={newTopic.description}
                onChange={(e) => setNewTopic({ ...newTopic, description: e.target.value })}
              />
              <Input
                className="col-span-1"
                type="number"
                min={0}
                value={newTopic.sort_order}
                onChange={(e) => setNewTopic({ ...newTopic, sort_order: Number(e.target.value) })}
              />
              <Button type="submit" className="col-span-1"><Plus className="w-4 h-4" /></Button>
            </div>
          </form>
        )}

        {topics.length === 0 ? (
          <EmptyState title="No syllabus topics yet" />
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {topics.map((t) => (
              <div key={t.id} className="p-3 flex items-start gap-3">
                <span className="text-xs text-slate-400 font-mono w-6 flex-none text-right pt-1">{t.sort_order}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800">{t.title}</div>
                  {t.description && <div className="text-xs text-slate-500 mt-0.5">{t.description}</div>}
                  {t.completed_at && (
                    <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> completed
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <Badge variant={STATUS_TONE[t.status]}>{t.status.replace('_', ' ')}</Badge>
                  {canWrite && t.status !== 'completed' && (
                    <Button variant="ghost" size="sm" onClick={() => setStatus(t, 'completed')} title="Mark complete">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </Button>
                  )}
                  {canWrite && (
                    <Button variant="ghost" size="sm" onClick={() => deleteTopic(t)} title="Delete">
                      <X className="w-4 h-4 text-slate-400" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
