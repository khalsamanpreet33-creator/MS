import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, IdCard, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';

interface IdCardTemplate {
  id: string;
  name: string;
  audience: 'student' | 'staff';
  template_html: string;
  width_mm: number;
  height_mm: number;
  status: 'active' | 'inactive';
}

const DEFAULT_STUDENT_TEMPLATE = `<div class="id-card">
  <div class="header"><h2>{{school_name}}</h2><div>STUDENT ID</div></div>
  <div class="body">
    <div class="photo">[PHOTO]</div>
    <div class="info">
      <div class="name">{{name}}</div>
      <div>Class: {{class_name}} / {{section_name}}</div>
      <div>Adm No: {{admission_no}}</div>
      <div>DOB: {{date_of_birth}}</div>
      <div>Guardian: {{guardian_name}}</div>
    </div>
  </div>
  <div class="footer">Valid until: {{valid_until}}</div>
</div>`;

const DEFAULT_STAFF_TEMPLATE = `<div class="id-card">
  <div class="header"><h2>{{school_name}}</h2><div>STAFF ID</div></div>
  <div class="body">
    <div class="photo">[PHOTO]</div>
    <div class="info">
      <div class="name">{{full_name}}</div>
      <div>Designation: {{designation}}</div>
      <div>Department: {{department}}</div>
      <div>Employee ID: {{employee_id}}</div>
    </div>
  </div>
  <div class="footer">Valid until: {{valid_until}}</div>
</div>`;

export default function IdCards() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('idcards.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('idcards.delete'));
  const { show, node } = useToasts();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', audience: 'student' as IdCardTemplate['audience'],
    template_html: DEFAULT_STUDENT_TEMPLATE,
    width_mm: 54, height_mm: 86, status: 'active' as IdCardTemplate['status'],
  });

  const { data, isLoading } = useQuery<{ items: IdCardTemplate[] }>({
    queryKey: ['idcards'],
    queryFn: () => api.get('/idcards'),
  });

  const open = (t?: IdCardTemplate) => {
    if (t) {
      setEditingId(t.id);
      setForm({
        name: t.name, audience: t.audience,
        template_html: t.template_html,
        width_mm: t.width_mm, height_mm: t.height_mm, status: t.status,
      });
    } else {
      setEditingId(null);
      setForm({
        name: '', audience: 'student', template_html: DEFAULT_STUDENT_TEMPLATE,
        width_mm: 54, height_mm: 86, status: 'active',
      });
    }
    setEditorOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name, audience: form.audience,
        template_html: form.template_html,
        width_mm: Number(form.width_mm), height_mm: Number(form.height_mm),
        status: form.status,
      };
      if (editingId) {
        await api.patch(`/idcards/${editingId}`, payload);
        show('Template updated', 'success');
      } else {
        await api.post('/idcards', payload);
        show('Template created', 'success');
      }
      setEditorOpen(false);
      qc.invalidateQueries({ queryKey: ['idcards'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (t: IdCardTemplate) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api.delete(`/idcards/${t.id}`);
      show('Template deleted', 'success');
      qc.invalidateQueries({ queryKey: ['idcards'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="ID Cards"
        description={`${data?.items.length ?? 0} template(s)`}
        actions={canWrite && <Button onClick={() => open()}><Plus className="w-4 h-4" /> New Template</Button>}
      />

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No ID card templates"
            description="Create your first ID card template."
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                  <td className="px-4 py-3"><Badge variant="info">{t.audience}</Badge></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{t.width_mm} × {t.height_mm} mm</td>
                  <td className="px-4 py-3"><Badge variant={t.status === 'active' ? 'success' : 'default'}>{t.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button onClick={() => open(t)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(t)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
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

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? 'Edit ID Card Template' : 'New ID Card Template'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
            </FormField>
            <FormField label="Audience" required>
              <Select value={form.audience} onChange={(e) => {
                const audience = e.target.value as IdCardTemplate['audience'];
                setForm({
                  ...form, audience,
                  template_html: form.template_html === DEFAULT_STUDENT_TEMPLATE || form.template_html === DEFAULT_STAFF_TEMPLATE
                    ? (audience === 'student' ? DEFAULT_STUDENT_TEMPLATE : DEFAULT_STAFF_TEMPLATE)
                    : form.template_html,
                });
              }}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </Select>
            </FormField>
            <FormField label="Width (mm)">
              <Input type="number" value={form.width_mm} onChange={(e) => setForm({ ...form, width_mm: Number(e.target.value) })} />
            </FormField>
            <FormField label="Height (mm)">
              <Input type="number" value={form.height_mm} onChange={(e) => setForm({ ...form, height_mm: Number(e.target.value) })} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IdCardTemplate['status'] })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Template HTML" hint="Use {{placeholders}} for fields like {{name}}, {{class_name}}, etc.">
            <Textarea value={form.template_html} onChange={(e) => setForm({ ...form, template_html: e.target.value })} rows={12} className="font-mono text-xs" required />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}