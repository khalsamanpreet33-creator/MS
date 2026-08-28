import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Search, Star, UserPlus, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';

interface Parent {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  status: 'active' | 'inactive';
  student_count: number;
  created_at: string;
}

interface LinkedStudent {
  id: string;
  relation: 'father' | 'mother' | 'guardian' | 'other';
  is_primary: number;
  student_id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  student_status: string;
  class_name: string | null;
  section_name: string | null;
}

interface ParentDetail extends Parent {
  address: string | null;
  notes: string | null;
  students: LinkedStudent[];
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  occupation: string;
  address: string;
  notes: string;
  status: 'active' | 'inactive';
}

const EMPTY: FormState = {
  full_name: '', email: '', phone: '', occupation: '', address: '', notes: '', status: 'active',
};

interface Student { id: string; admission_no: string; first_name: string; last_name: string; }

export default function Parents() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('parents.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('parents.delete'));
  const { show, node } = useToasts();

  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ParentDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ student_id: '', relation: 'guardian' as LinkedStudent['relation'], is_primary: false });
  const [studentSearch, setStudentSearch] = useState('');

  const { data, isLoading } = useQuery<{ items: Parent[] }>({
    queryKey: ['parents', q],
    queryFn: () => api.get(`/parents?q=${encodeURIComponent(q)}`),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students-for-link', studentSearch],
    queryFn: () => api.get(`/students?q=${encodeURIComponent(studentSearch)}&pageSize=20`)
      .then((r: { items: Student[] }) => r.items),
    enabled: linkOpen,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const detail = await api.get<ParentDetail>(`/parents/${id}`);
      setEditing(detail);
      setForm({
        full_name: detail.full_name,
        email: detail.email ?? '',
        phone: detail.phone ?? '',
        occupation: detail.occupation ?? '',
        address: detail.address ?? '',
        notes: detail.notes ?? '',
        status: detail.status,
      });
      setModalOpen(true);
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        occupation: form.occupation || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      if (editing) {
        await api.patch(`/parents/${editing.id}`, payload);
        show('Parent updated', 'success');
      } else {
        await api.post('/parents', payload);
        show('Parent created', 'success');
      }
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ['parents'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete parent "${name}"? Linked students will be unlinked.`)) return;
    try {
      await api.delete(`/parents/${id}`);
      show('Parent deleted', 'success');
      qc.invalidateQueries({ queryKey: ['parents'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openDetail = async (id: string) => {
    try {
      const detail = await api.get<ParentDetail>(`/parents/${id}`);
      setEditing(detail);
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.post(`/parents/${editing.id}/links`, {
        student_id: linkForm.student_id,
        relation: linkForm.relation,
        is_primary: linkForm.is_primary,
      });
      show('Student linked', 'success');
      setLinkOpen(false);
      setLinkForm({ student_id: '', relation: 'guardian', is_primary: false });
      const detail = await api.get<ParentDetail>(`/parents/${editing.id}`);
      setEditing(detail);
      qc.invalidateQueries({ queryKey: ['parents'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const removeLink = async (linkId: string) => {
    if (!editing) return;
    if (!confirm('Unlink this student?')) return;
    try {
      await api.delete(`/parents/${editing.id}/links/${linkId}`);
      show('Link removed', 'success');
      const detail = await api.get<ParentDetail>(`/parents/${editing.id}`);
      setEditing(detail);
      qc.invalidateQueries({ queryKey: ['parents'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const setPrimary = async (linkId: string) => {
    if (!editing) return;
    try {
      await api.patch(`/parents/${editing.id}/links/${linkId}/primary`, {});
      const detail = await api.get<ParentDetail>(`/parents/${editing.id}`);
      setEditing(detail);
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Parents Directory"
        description={`${data?.items.length ?? 0} parent(s)`}
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> Add Parent
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="p-4 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search by name, email, phone..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </Card>

          <Card>
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : (data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No parents found"
                description="Add parents or adjust your filters."
              />
            ) : (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Occupation</th>
                    <th className="px-4 py-3">Students</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${
                        editing?.id === p.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => openDetail(p.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.full_name}</td>
                      <td className="px-4 py-3 text-sm">
                        {p.email && <div className="text-slate-700">{p.email}</div>}
                        {p.phone && <div className="text-slate-500 text-xs">{p.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.occupation ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.student_count}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === 'active' ? 'success' : 'default'}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {canWrite && (
                          <button
                            onClick={() => openEdit(p.id)}
                            className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs mr-1"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => remove(p.id, p.full_name)}
                            className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                          >
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
          {editing ? (
            <Card className="p-5 sticky top-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-semibold text-slate-900">{editing.full_name}</div>
                  <div className="text-xs text-slate-500">{editing.email ?? 'No email'}</div>
                  <div className="text-xs text-slate-500">{editing.phone ?? 'No phone'}</div>
                </div>
                <Badge variant={editing.status === 'active' ? 'success' : 'default'}>{editing.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <div className="text-slate-500">Occupation</div>
                  <div className="text-slate-900">{editing.occupation ?? '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Linked students</div>
                  <div className="text-slate-900">{editing.student_count}</div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-slate-700">Linked Students</div>
                  {canWrite && (
                    <Button size="sm" variant="secondary" onClick={() => setLinkOpen(true)}>
                      <UserPlus className="w-3 h-3" /> Link
                    </Button>
                  )}
                </div>
                {editing.students.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">No students linked yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {editing.students.map((s) => (
                      <div key={s.id} className="py-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {s.is_primary ? (
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            ) : (
                              <span className="w-3 h-3" />
                            )}
                            <Link
                              to={`/students/${s.student_id}`}
                              className="text-sm font-medium text-slate-900 hover:text-blue-600 truncate"
                            >
                              {s.first_name} {s.last_name}
                            </Link>
                          </div>
                          <div className="text-xs text-slate-500 ml-5">
                            {s.class_name ?? '—'}{s.section_name ? ` · ${s.section_name}` : ''} · {s.relation}
                          </div>
                        </div>
                        {canWrite && (
                          <div className="flex items-center gap-1">
                            {s.is_primary === 0 && (
                              <button
                                onClick={() => setPrimary(s.id)}
                                className="text-slate-500 hover:bg-slate-100 p-1 rounded"
                                title="Set as primary"
                              >
                                <Star className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => removeLink(s.id)}
                              className="text-red-500 hover:bg-red-50 p-1 rounded"
                              title="Unlink"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {editing.notes && (
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <div className="text-xs text-slate-500 mb-1">Notes</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{editing.notes}</div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-400 text-sm">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Select a parent to view details.
            </Card>
          )}
        </div>
      </div>

      {/* Edit/Create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.full_name}` : 'Add Parent'}>
        <form onSubmit={save} className="space-y-3">
          <FormField label="Full Name" required>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
            <FormField label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Occupation">
              <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="e.g. Engineer" />
            </FormField>
            <FormField label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Address">
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Link modal */}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Link Student">
        <form onSubmit={addLink} className="space-y-3">
          <FormField label="Search Student">
            <Input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Name or admission #" />
          </FormField>
          <FormField label="Student" required>
            <Select
              value={linkForm.student_id}
              onChange={(e) => setLinkForm({ ...linkForm, student_id: e.target.value })}
              required
            >
              <option value="">Select student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.admission_no} - {s.first_name} {s.last_name}</option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Relation">
              <Select
                value={linkForm.relation}
                onChange={(e) => setLinkForm({ ...linkForm, relation: e.target.value as LinkedStudent['relation'] })}
              >
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="other">Other</option>
              </Select>
            </FormField>
            <FormField label="Primary">
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={linkForm.is_primary}
                  onChange={(e) => setLinkForm({ ...linkForm, is_primary: e.target.checked })}
                />
                <span className="text-sm text-slate-700">Mark as primary contact</span>
              </label>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button type="submit">Link Student</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
