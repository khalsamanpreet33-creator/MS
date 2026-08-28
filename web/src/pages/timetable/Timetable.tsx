import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, Calendar, User, BookOpen, X, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Badge,
  useToasts, EmptyState, Modal, FormField,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { classNames } from '../../lib/format';

interface Period {
  id: string;
  class_id: string;
  section_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_id: string;
  teacher_name: string;
  room: string | null;
  notes: string | null;
}

interface Substitution {
  id: string;
  period_id: string;
  substitute_teacher_id: string;
  substitute_teacher_name: string;
  original_teacher_name: string;
  substitution_date: string;
  reason: string | null;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  section_name: string;
  class_name: string;
  subject_name: string;
  subject_code: string;
}

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; class_id: string; }
interface Subject { id: string; name: string; code: string; class_id: string; }
interface Teacher { id: string; full_name: string; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Timetable() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('timetable.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('timetable.delete'));
  const { show, node } = useToasts();

  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    class_id: '', section_id: '', day_of_week: 1, period_number: 1,
    start_time: '09:00', end_time: '09:45',
    subject_id: '', teacher_id: '', room: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [subOpen, setSubOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    period_id: '', substitute_teacher_id: '',
    substitution_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const { data, isLoading } = useQuery<{ items: Period[] }>({
    queryKey: ['timetable', filterClass, filterSection, filterTeacher],
    queryFn: () => api.get(`/timetable?classId=${filterClass}&sectionId=${filterSection}&teacherId=${filterTeacher}`),
    enabled: !!filterClass || !!filterTeacher,
  });

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data: sections = [] } = useQuery<SectionItem[]>({
    queryKey: ['class-sections', filterClass],
    queryFn: () => filterClass
      ? api.get(`/classes/${filterClass}/sections`).then((r: { items: SectionItem[] }) => r.items)
      : Promise.resolve([]),
    enabled: !!filterClass,
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ['subjects-list'],
    queryFn: () => api.get('/subjects').then((r: { items: Subject[] }) => r.items),
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ['teachers-options'],
    queryFn: () => api.get('/roles/teachers').then((r: { items: Teacher[] }) => r.items),
  });

  const { data: subs } = useQuery<{ items: Substitution[] }>({
    queryKey: ['substitutions'],
    queryFn: () => api.get('/timetable/substitutions'),
  });

  // Build a 7×N grid for the selected section.
  const grid = useMemo(() => {
    const maxPeriod = (data?.items ?? []).reduce(
      (m, p) => Math.max(m, p.period_number), 0,
    ) || 8;
    const map: Record<string, Period> = {};
    for (const p of data?.items ?? []) {
      map[`${p.day_of_week}-${p.period_number}`] = p;
    }
    const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
    return { periods, map };
  }, [data]);

  const subjectsForClass = form.class_id
    ? subjects.filter((s) => s.class_id === form.class_id)
    : [];

  const openCreate = () => {
    setEditingId(null);
    setForm({
      class_id: filterClass, section_id: filterSection,
      day_of_week: 1, period_number: (grid.periods[grid.periods.length - 1] ?? 0) + 1,
      start_time: '09:00', end_time: '09:45',
      subject_id: '', teacher_id: '', room: '', notes: '',
    });
    setEditorOpen(true);
  };

  const openEdit = (p: Period) => {
    setEditingId(p.id);
    setForm({
      class_id: p.class_id, section_id: p.section_id,
      day_of_week: p.day_of_week, period_number: p.period_number,
      start_time: p.start_time, end_time: p.end_time,
      subject_id: p.subject_id, teacher_id: p.teacher_id,
      room: p.room ?? '', notes: p.notes ?? '',
    });
    setEditorOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        class_id: form.class_id,
        section_id: form.section_id,
        day_of_week: Number(form.day_of_week),
        period_number: Number(form.period_number),
        start_time: form.start_time,
        end_time: form.end_time,
        subject_id: form.subject_id,
        teacher_id: form.teacher_id,
        room: form.room || null,
        notes: form.notes || null,
      };
      if (editingId) {
        await api.patch(`/timetable/${editingId}`, payload);
        show('Period updated', 'success');
      } else {
        await api.post('/timetable', payload);
        show('Period added', 'success');
      }
      setEditorOpen(false);
      qc.invalidateQueries({ queryKey: ['timetable'] });
    } catch (e) {
      const err = e as ApiError & { conflicts?: unknown };
      if (err.message?.includes('conflict') || err.message?.includes('duplicate')) {
        show(`Conflict: ${err.message}`, 'error');
      } else {
        show(err.message, 'error');
      }
    } finally { setSaving(false); }
  };

  const remove = async (p: Period) => {
    if (!confirm(`Delete ${DAYS[p.day_of_week]} period ${p.period_number} (${p.subject_code})?`)) return;
    try {
      await api.delete(`/timetable/${p.id}`);
      show('Period deleted', 'success');
      qc.invalidateQueries({ queryKey: ['timetable'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const addSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/timetable/substitutions', {
        period_id: subForm.period_id,
        substitute_teacher_id: subForm.substitute_teacher_id,
        substitution_date: subForm.substitution_date,
        reason: subForm.reason || null,
      });
      show('Substitution recorded', 'success');
      setSubOpen(false);
      setSubForm({ period_id: '', substitute_teacher_id: '', substitution_date: new Date().toISOString().slice(0, 10), reason: '' });
      qc.invalidateQueries({ queryKey: ['substitutions'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const removeSub = async (id: string) => {
    if (!confirm('Remove this substitution?')) return;
    try {
      await api.delete(`/timetable/substitutions/${id}`);
      show('Substitution removed', 'success');
      qc.invalidateQueries({ queryKey: ['substitutions'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Timetable"
        description={filterSection ? `Section grid` : 'Select a class to view its weekly grid'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSubOpen(true)}>
              <User className="w-4 h-4" /> Substitution
            </Button>
            {canWrite && filterSection && (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" /> Add Period
              </Button>
            )}
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <Select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setFilterSection(''); }} className="w-auto">
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {filterClass && (
            <Select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="w-auto">
              <option value="">All sections</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          <Select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="w-auto">
            <option value="">All teachers</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </Select>
        </div>
      </Card>

      {!filterClass && !filterTeacher ? (
        <Card className="p-12 text-center text-slate-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
          Pick a class or teacher to view timetable.
        </Card>
      ) : isLoading ? (
        <Card className="p-8 text-center text-slate-400">Loading...</Card>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No periods scheduled"
          description="Add a period to start building the weekly timetable."
          action={canWrite && filterSection ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Period</Button> : undefined}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 w-20">
                  Period
                </th>
                {DAYS.map((d, i) => (
                  <th key={d} className="px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 min-w-[140px]">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.periods.map((periodNum) => (
                <tr key={periodNum}>
                  <td className="px-3 py-2 text-xs text-slate-500 font-semibold border-r border-slate-100 align-top">
                    <div>Period {periodNum}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {data?.items.find((p) => p.period_number === periodNum)?.start_time ?? ''}
                    </div>
                  </td>
                  {DAYS.map((_, day) => {
                    const p = grid.map[`${day}-${periodNum}`];
                    return (
                      <td
                        key={day}
                        className={classNames(
                          'px-2 py-2 border-r border-b border-slate-100 align-top min-h-[60px]',
                          p ? 'bg-blue-50' : '',
                        )}
                      >
                        {p && (
                          <div className="group relative">
                            <Badge variant="info">{p.subject_code}</Badge>
                            <div className="mt-1 text-xs text-slate-700 truncate">{p.subject_name}</div>
                            <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {p.teacher_name}
                            </div>
                            <div className="text-xs text-slate-500">{p.start_time}-{p.end_time}</div>
                            {p.room && <div className="text-xs text-slate-400">Room: {p.room}</div>}
                            {canWrite && (
                              <div className="absolute top-1 right-1 hidden group-hover:flex gap-1 bg-white rounded shadow p-0.5">
                                <button onClick={() => openEdit(p)} className="text-slate-600 hover:bg-slate-100 p-1 rounded" title="Edit">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                {canDelete && (
                                  <button onClick={() => remove(p)} className="text-red-600 hover:bg-red-50 p-1 rounded" title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(subs?.items.length ?? 0) > 0 && (
        <Card className="mt-4 p-4">
          <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Recent Substitutions ({subs!.items.length})
          </div>
          <div className="space-y-2">
            {subs!.items.slice(0, 10).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm bg-amber-50 border border-amber-200 rounded p-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">
                    {s.class_name} / {s.section_name} · {DAYS[s.day_of_week]} P{s.period_number} · {s.subject_code}
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="line-through">{s.original_teacher_name}</span>
                    {' → '}
                    <span className="font-medium text-emerald-700">{s.substitute_teacher_name}</span>
                    {' · '}{s.substitution_date}
                    {s.reason && <span className="text-slate-500"> · {s.reason}</span>}
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => removeSub(s.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? 'Edit Period' : 'New Period'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Class" required>
              <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, section_id: '', subject_id: '' })} required>
                <option value="">Select class...</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Section" required>
              <Select value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} required disabled={!form.class_id}>
                <option value="">Select section...</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Day" required>
              <Select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </Select>
            </FormField>
            <FormField label="Period #" required>
              <Input type="number" min={1} max={12} value={form.period_number} onChange={(e) => setForm({ ...form, period_number: Number(e.target.value) })} required />
            </FormField>
            <FormField label="Start Time" required>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </FormField>
            <FormField label="End Time" required>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </FormField>
            <FormField label="Subject" required>
              <Select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required disabled={!form.class_id}>
                <option value="">Select subject...</option>
                {subjectsForClass.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Teacher" required>
              <Select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} required>
                <option value="">Select teacher...</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            </FormField>
            <FormField label="Room">
              <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} maxLength={50} placeholder="e.g. Room 101" />
            </FormField>
          </div>
          <FormField label="Notes">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
          </FormField>
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>Server validates teacher and section double-booking. Conflicts will be rejected.</div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={subOpen} onClose={() => setSubOpen(false)} title="Record Substitution" size="lg">
        <form onSubmit={addSubstitution} className="space-y-3">
          <FormField label="Period" required hint="Pick any existing timetable slot">
            <Select value={subForm.period_id} onChange={(e) => setSubForm({ ...subForm, period_id: e.target.value })} required>
              <option value="">Select period...</option>
              {(data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {DAYS[p.day_of_week]} P{p.period_number} · {p.subject_code} · {p.teacher_name}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <Input type="date" value={subForm.substitution_date} onChange={(e) => setSubForm({ ...subForm, substitution_date: e.target.value })} required />
            </FormField>
            <FormField label="Substitute Teacher" required>
              <Select value={subForm.substitute_teacher_id} onChange={(e) => setSubForm({ ...subForm, substitute_teacher_id: e.target.value })} required>
                <option value="">Select teacher...</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Reason">
            <Input value={subForm.reason} onChange={(e) => setSubForm({ ...form, reason: e.target.value } as never)} placeholder="Optional" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setSubOpen(false)}>Cancel</Button>
            <Button type="submit"><BookOpen className="w-4 h-4" /> Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}