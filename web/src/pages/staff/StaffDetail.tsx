import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Badge, Modal, FormField, Input, Select,
  useToasts,
} from '../../components/ui';
import { formatDate } from '../../lib/format';
import { useAuthStore } from '../../store/auth';

interface StaffDetail {
  id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  joining_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  document_count: number;
  created_at: string;
  updated_at: string;
  documents: {
    id: string;
    doc_type: string;
    title: string;
    file_path: string | null;
    notes: string | null;
    uploaded_at: string;
    uploaded_by: string | null;
  }[];
}

interface FormState {
  employee_code: string;
  full_name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  joining_date: string;
  status: 'active' | 'inactive';
  notes: string;
}

export default function StaffDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('staff.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('staff.delete'));
  const { show, node } = useToasts();

  const { data: staff, isLoading } = useQuery<StaffDetail>({
    queryKey: ['staff', id],
    queryFn: () => api.get(`/staff/${id}`),
    enabled: !!id,
  });

  const [tab, setTab] = useState<'profile' | 'documents'>('profile');

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({ doc_type: 'ID Proof', title: '', notes: '', file_path: '' });
  const [docSaving, setDocSaving] = useState(false);

  const openEdit = () => {
    if (!staff) return;
    setEditForm({
      employee_code: staff.employee_code,
      full_name: staff.full_name,
      department: staff.department ?? '',
      designation: staff.designation ?? '',
      email: staff.email ?? '',
      phone: staff.phone ?? '',
      joining_date: staff.joining_date ?? '',
      status: staff.status,
      notes: staff.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm || !staff) return;
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        department: editForm.department || null,
        designation: editForm.designation || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        joining_date: editForm.joining_date || null,
        notes: editForm.notes || null,
      };
      await api.patch(`/staff/${staff.id}`, payload);
      show('Staff updated', 'success');
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ['staff', id] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff-departments'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!staff) return;
    if (!confirm(`Archive "${staff.full_name}"? They will be marked inactive.`)) return;
    try {
      await api.delete(`/staff/${staff.id}`);
      show('Staff archived', 'success');
      qc.invalidateQueries({ queryKey: ['staff', id] });
      qc.invalidateQueries({ queryKey: ['staff'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;
    setDocSaving(true);
    try {
      await api.post(`/staff/${staff.id}/documents`, {
        doc_type: docForm.doc_type,
        title: docForm.title,
        notes: docForm.notes || null,
        file_path: docForm.file_path || null,
      });
      show('Document added', 'success');
      setDocOpen(false);
      setDocForm({ doc_type: 'ID Proof', title: '', notes: '', file_path: '' });
      qc.invalidateQueries({ queryKey: ['staff', id] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setDocSaving(false);
    }
  };

  const removeDoc = async (docId: string, title: string) => {
    if (!staff) return;
    if (!confirm(`Delete document "${title}"?`)) return;
    try {
      await api.delete(`/staff/${staff.id}/documents/${docId}`);
      show('Document removed', 'success');
      qc.invalidateQueries({ queryKey: ['staff', id] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  if (isLoading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (!staff) return <div className="p-8 text-slate-400">Staff not found.</div>;

  return (
    <div>
      {node}
      <PageHeader
        title={staff.full_name}
        description={`Employee ${staff.employee_code} · ${staff.department ?? 'No department'} · ${staff.designation ?? 'No designation'}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/staff')}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            {canWrite && (
              <Button variant="secondary" onClick={openEdit}>
                <Pencil className="w-4 h-4" /> Edit
              </Button>
            )}
            {canDelete && staff.status === 'active' && (
              <Button variant="danger" onClick={archive}>
                <Trash2 className="w-4 h-4" /> Archive
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['profile', 'documents'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t === 'documents' ? `Documents (${staff.documents.length})` : 'Profile'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Badge variant={staff.status === 'active' ? 'success' : 'default'}>{staff.status}</Badge>
            </div>
            <div className="text-xs text-slate-500">
              Joined {formatDate(staff.joining_date)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Employee Code" value={staff.employee_code} />
            <Field label="Full Name" value={staff.full_name} />
            <Field label="Department" value={staff.department ?? '—'} />
            <Field label="Designation" value={staff.designation ?? '—'} />
            <Field label="Email" value={staff.email ?? '—'} />
            <Field label="Phone" value={staff.phone ?? '—'} />
            <Field label="Joining Date" value={formatDate(staff.joining_date)} />
            <Field label="Created" value={formatDate(staff.created_at)} />
          </div>
          {staff.notes && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Notes</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap">{staff.notes}</div>
            </div>
          )}
        </Card>
      )}

      {tab === 'documents' && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-600">{staff.documents.length} document(s) on file</div>
            {canWrite && (
              <Button size="sm" onClick={() => setDocOpen(true)}>
                <Plus className="w-4 h-4" /> Add Document
              </Button>
            )}
          </div>
          {staff.documents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {staff.documents.map((d) => (
                <div key={d.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{d.doc_type}</Badge>
                      <span className="font-medium text-slate-900 truncate">{d.title}</span>
                    </div>
                    {d.notes && <div className="mt-1 text-xs text-slate-500">{d.notes}</div>}
                    {d.file_path && (
                      <a
                        href={d.file_path}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 text-xs text-blue-600 hover:underline truncate block"
                      >
                        {d.file_path}
                      </a>
                    )}
                    <div className="mt-1 text-xs text-slate-400">
                      Uploaded {formatDate(d.uploaded_at)}
                    </div>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => removeDoc(d.id, d.title)}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Staff" size="lg">
        {editForm && (
          <form onSubmit={saveEdit} className="grid grid-cols-2 gap-3">
            <FormField label="Employee Code" required>
              <Input
                value={editForm.employee_code}
                onChange={(e) => setEditForm({ ...editForm, employee_code: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Full Name" required>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Department">
              <Input
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
              />
            </FormField>
            <FormField label="Designation">
              <Input
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </FormField>
            <FormField label="Phone">
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Joining Date">
              <Input
                type="date"
                value={editForm.joining_date}
                onChange={(e) => setEditForm({ ...editForm, joining_date: e.target.value })}
              />
            </FormField>
            <FormField label="Status">
              <Select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
            <div className="col-span-2">
              <FormField label="Notes">
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </FormField>
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add document modal */}
      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Add Document">
        <form onSubmit={addDoc} className="space-y-3">
          <FormField label="Document Type" required>
            <Select
              value={docForm.doc_type}
              onChange={(e) => setDocForm({ ...docForm, doc_type: e.target.value })}
            >
              <option>ID Proof</option>
              <option>Resume</option>
              <option>Contract</option>
              <option>Certificate</option>
              <option>Address Proof</option>
              <option>Other</option>
            </Select>
          </FormField>
          <FormField label="Title" required>
            <Input
              value={docForm.title}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
              required
              placeholder="e.g. Aadhaar Card"
            />
          </FormField>
          <FormField label="File Reference (URL or path)" hint="Optional — paste a link or storage path">
            <Input
              value={docForm.file_path}
              onChange={(e) => setDocForm({ ...docForm, file_path: e.target.value })}
              placeholder="https://..."
            />
          </FormField>
          <FormField label="Notes">
            <Input
              value={docForm.notes}
              onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setDocOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={docSaving}>
              {docSaving ? 'Adding...' : 'Add Document'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value}</div>
    </div>
  );
}
