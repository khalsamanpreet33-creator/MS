import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Input, Select, FormField, useToasts, Table, Modal, EmptyState,
} from '../components/ui';

interface ClassItem {
  id: string;
  name: string;
  grade_level: number;
  academic_year: string;
  class_teacher_name: string | null;
  section_count: number;
  student_count: number;
}

interface SectionItem {
  id: string;
  class_id: string;
  name: string;
  capacity: number;
  class_teacher_name: string | null;
  student_count: number;
}

interface TeacherItem { id: string; full_name: string; }

export default function Classes() {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const [showCreate, setShowCreate] = useState(false);
  const [creatingSectionFor, setCreatingSectionFor] = useState<string | null>(null);

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data: teachers = [] } = useQuery<TeacherItem[]>({
    queryKey: ['teachers-lookup'],
    queryFn: () => api.get('/classes/teachers/lookup').then((r: { items: TeacherItem[] }) => r.items),
  });

  const [form, setForm] = useState({ name: '', grade_level: 1, academic_year: '2025-2026', class_teacher_id: '' });
  const [sectionForm, setSectionForm] = useState({ name: '', capacity: 40, class_teacher_id: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/classes', form);
      show('Class created', 'success');
      setShowCreate(false);
      setForm({ name: '', grade_level: 1, academic_year: '2025-2026', class_teacher_id: '' });
      qc.invalidateQueries({ queryKey: ['classes-list'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const submitSection = async (classId: string) => {
    try {
      await api.post(`/classes/${classId}/sections`, sectionForm);
      show('Section added', 'success');
      setCreatingSectionFor(null);
      setSectionForm({ name: '', capacity: 40, class_teacher_id: '' });
      qc.invalidateQueries({ queryKey: ['classes-list'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Classes & Sections"
        description="Manage the academic structure"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Add class
          </Button>
        }
      />

      <div className="space-y-4">
        {classes.length === 0 && <EmptyState title="No classes yet" description="Create your first class to get started." />}
        {classes.map((cls) => (
          <ClassCard
            key={cls.id}
            cls={cls}
            teachers={teachers}
            onAddSection={() => setCreatingSectionFor(cls.id)}
            onCreateSection={() => submitSection(cls.id)}
            creatingSectionFor={creatingSectionFor === cls.id}
            sectionForm={sectionForm}
            setSectionForm={setSectionForm}
          />
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New class">
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Grade 1" required />
          </FormField>
          <FormField label="Grade level" required>
            <Input
              type="number"
              min={0}
              max={20}
              value={form.grade_level}
              onChange={(e) => setForm({ ...form, grade_level: Number(e.target.value) })}
              required
            />
          </FormField>
          <FormField label="Academic year" required>
            <Input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} required />
          </FormField>
          <FormField label="Class teacher">
            <Select value={form.class_teacher_id} onChange={(e) => setForm({ ...form, class_teacher_id: e.target.value })}>
              <option value="">—</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
          </FormField>
          <div className="flex justify-end">
            <Button type="submit">Create class</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ClassCard({
  cls, teachers, onAddSection, onCreateSection, creatingSectionFor, sectionForm, setSectionForm,
}: {
  cls: ClassItem;
  teachers: TeacherItem[];
  onAddSection: () => void;
  onCreateSection: () => void;
  creatingSectionFor: boolean;
  sectionForm: { name: string; capacity: number; class_teacher_id: string };
  setSectionForm: (v: { name: string; capacity: number; class_teacher_id: string }) => void;
}) {
  const { data: sections = [], isLoading } = useQuery<SectionItem[]>({
    queryKey: ['sections', cls.id],
    queryFn: () => api.get(`/classes/${cls.id}/sections`).then((r: { items: SectionItem[] }) => r.items),
  });

  const qc = useQueryClient();
  const { show } = useToasts();
  const removeSection = async (id: string, name: string) => {
    if (!confirm(`Remove section ${name}?`)) return;
    try {
      await api.delete(`/classes/sections/${id}`);
      show('Section removed', 'success');
      qc.invalidateQueries({ queryKey: ['sections', cls.id] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">{cls.name}</div>
          <div className="text-xs text-slate-500">
            Grade {cls.grade_level} · {cls.academic_year} · {cls.section_count} sections · {cls.student_count} students · Teacher: {cls.class_teacher_name ?? '—'}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={onAddSection}>
          <Plus className="w-4 h-4" /> Section
        </Button>
      </div>

      {creatingSectionFor && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="grid md:grid-cols-4 gap-2">
            <Input placeholder="A / B / C..." value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} />
            <Input type="number" placeholder="capacity" value={sectionForm.capacity} onChange={(e) => setSectionForm({ ...sectionForm, capacity: Number(e.target.value) })} />
            <Select value={sectionForm.class_teacher_id} onChange={(e) => setSectionForm({ ...sectionForm, class_teacher_id: e.target.value })}>
              <option value="">Teacher (optional)</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
            <Button onClick={onCreateSection} disabled={!sectionForm.name}>Create</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="mt-3 text-sm text-slate-400">Loading sections...</div>
      ) : sections.length > 0 && (
        <Table>
          <thead className="text-xs text-slate-500">
            <tr><th className="px-2 py-2 text-left">Section</th><th className="px-2 py-2 text-left">Capacity</th><th className="px-2 py-2 text-left">Teacher</th><th className="px-2 py-2 text-left">Students</th><th></th></tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-2 py-2 font-medium">{s.name}</td>
                <td className="px-2 py-2">{s.capacity}</td>
                <td className="px-2 py-2">{s.class_teacher_name ?? '—'}</td>
                <td className="px-2 py-2">{s.student_count}</td>
                <td className="px-2 py-2 text-right">
                  <button onClick={() => removeSection(s.id, s.name)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}