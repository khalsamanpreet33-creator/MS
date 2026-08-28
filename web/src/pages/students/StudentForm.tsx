import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, FormField, Textarea, useToasts,
} from '../../components/ui';

interface ClassItem {
  id: string;
  name: string;
}
interface SectionItem {
  id: string;
  name: string;
  class_id: string;
}

export default function StudentForm() {
  const { id: idParam } = useParams();
  const isEdit = !!idParam;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { show, node } = useToasts();

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data: sections = [] } = useQuery<SectionItem[]>({
    queryKey: ['sections-all'],
    queryFn: () => api.get('/classes/all-sections').then((r: { items: SectionItem[] }) => r.items).catch(() => []),
  });

  const { data: existing } = useQuery<Record<string, unknown>>({
    queryKey: ['student', idParam],
    queryFn: () => api.get(`/students/${idParam}`),
    enabled: isEdit,
  });

  const [form, setForm] = useState({
    admission_no: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    blood_group: '',
    address: '',
    guardian_name: '',
    guardian_relation: '',
    guardian_phone: '',
    guardian_email: '',
    emergency_contact: '',
    joining_date: new Date().toISOString().slice(0, 10),
    current_class_id: '',
    current_section_id: '',
  });

  // Initialize form when editing data arrives
  useEffect(() => {
    if (existing && isEdit) {
      const e = existing as Record<string, string | null | undefined>;
      setForm({
        admission_no: e.admission_no ?? '',
        first_name: e.first_name ?? '',
        last_name: e.last_name ?? '',
        date_of_birth: e.date_of_birth ?? '',
        gender: e.gender ?? '',
        blood_group: e.blood_group ?? '',
        address: e.address ?? '',
        guardian_name: e.guardian_name ?? '',
        guardian_relation: e.guardian_relation ?? '',
        guardian_phone: e.guardian_phone ?? '',
        guardian_email: e.guardian_email ?? '',
        emergency_contact: e.emergency_contact ?? '',
        joining_date: e.joining_date ?? new Date().toISOString().slice(0, 10),
        current_class_id: e.current_class_id ?? '',
        current_section_id: e.current_section_id ?? '',
      });
    }
  }, [existing, isEdit]);

  const filteredSections = sections.filter((s) => s.class_id === form.current_class_id);

  const onChange = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === 'current_class_id' ? { current_section_id: '' } : {}) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await api.patch(`/students/${idParam}`, form);
        show('Student updated', 'success');
      } else {
        await api.post('/students', form);
        show('Student created', 'success');
      }
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate('/students');
    } catch (e) {
      const err = e as ApiError;
      show(err.message, 'error');
    }
  };

  return (
    <div>
      {node}
      <PageHeader
        title={isEdit ? 'Edit student' : 'New student'}
        actions={
          <Button variant="secondary" onClick={() => navigate('/students')}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      <form onSubmit={submit} className="space-y-4 max-w-4xl">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Basic information</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <FormField label="Admission No" required>
              <Input value={form.admission_no} onChange={(e) => onChange('admission_no', e.target.value)} required />
            </FormField>
            <FormField label="First name" required>
              <Input value={form.first_name} onChange={(e) => onChange('first_name', e.target.value)} required />
            </FormField>
            <FormField label="Last name" required>
              <Input value={form.last_name} onChange={(e) => onChange('last_name', e.target.value)} required />
            </FormField>
            <FormField label="Date of birth">
              <Input type="date" value={form.date_of_birth} onChange={(e) => onChange('date_of_birth', e.target.value)} />
            </FormField>
            <FormField label="Gender">
              <Select value={form.gender} onChange={(e) => onChange('gender', e.target.value)}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
            <FormField label="Blood group">
              <Input value={form.blood_group} onChange={(e) => onChange('blood_group', e.target.value)} placeholder="A+, O-, ..." />
            </FormField>
            <FormField label="Joining date">
              <Input type="date" value={form.joining_date} onChange={(e) => onChange('joining_date', e.target.value)} />
            </FormField>
            <FormField label="Class">
              <Select value={form.current_class_id} onChange={(e) => onChange('current_class_id', e.target.value)}>
                <option value="">—</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Section">
              <Select value={form.current_section_id} onChange={(e) => onChange('current_section_id', e.target.value)} disabled={!form.current_class_id}>
                <option value="">—</option>
                {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </FormField>
            <div className="md:col-span-3">
              <FormField label="Address">
                <Textarea value={form.address} onChange={(e) => onChange('address', e.target.value)} rows={2} />
              </FormField>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Guardian</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <FormField label="Guardian name">
              <Input value={form.guardian_name} onChange={(e) => onChange('guardian_name', e.target.value)} />
            </FormField>
            <FormField label="Relation">
              <Input value={form.guardian_relation} onChange={(e) => onChange('guardian_relation', e.target.value)} placeholder="Father, Mother, ..." />
            </FormField>
            <FormField label="Phone">
              <Input value={form.guardian_phone} onChange={(e) => onChange('guardian_phone', e.target.value)} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={form.guardian_email} onChange={(e) => onChange('guardian_email', e.target.value)} />
            </FormField>
            <FormField label="Emergency contact">
              <Input value={form.emergency_contact} onChange={(e) => onChange('emergency_contact', e.target.value)} />
            </FormField>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">
            <Save className="w-4 h-4" /> {isEdit ? 'Save changes' : 'Create student'}
          </Button>
        </div>
      </form>
    </div>
  );
}