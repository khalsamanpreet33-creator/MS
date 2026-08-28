import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Eye, Trash2 } from 'lucide-react';
import { api, ApiError, downloadFile } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate, classNames } from '../../lib/format';

interface Student {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other' | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  status: string;
  current_class_id: string | null;
  current_section_id: string | null;
  class_name: string | null;
  section_name: string | null;
}

interface ListResp {
  total: number;
  page: number;
  pageSize: number;
  items: Student[];
}

interface ClassItem {
  id: string;
  name: string;
}

export default function StudentsList() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('students.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('students.delete'));
  const navigate = useNavigate();
  const { show, node } = useToasts();

  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ['students', q, classId, page],
    queryFn: () =>
      api.get(`/students?q=${encodeURIComponent(q)}&classId=${classId}&page=${page}&pageSize=${pageSize}`),
  });

  const remove = async (id: string, name: string) => {
    if (!confirm(`Soft-delete student "${name}"?`)) return;
    try {
      await api.delete(`/students/${id}`);
      show('Student archived', 'success');
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const exportFile = (format: 'pdf' | 'xlsx' | 'csv') => {
    downloadFile(`/students/export?format=${format}`, `students.${format}`);
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Students"
        description={`${data?.total ?? 0} total students`}
        actions={
          <div className="flex gap-2">
            <div className="hidden md:flex gap-1">
              <Button variant="secondary" size="sm" onClick={() => exportFile('csv')}>
                <Download className="w-4 h-4" /> CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => exportFile('xlsx')}>
                <Download className="w-4 h-4" /> Excel
              </Button>
            </div>
            {canWrite && (
              <Button onClick={() => navigate('/students/new')}>
                <Plus className="w-4 h-4" /> Add student
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, admission no, phone..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <div className="text-xs text-slate-500 self-center">
            Showing {data?.items.length ?? 0} of {data?.total ?? 0}
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No students found"
            description="Adjust your filters or add a new student."
          />
        ) : (
          <Table>
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Admission No</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Class / Section</th>
                <th className="px-4 py-3">Guardian</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.admission_no}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{s.first_name} {s.last_name}</div>
                    {s.gender && <div className="text-xs text-slate-400 capitalize">{s.gender}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.class_name ? `${s.class_name} / ${s.section_name ?? '-'}` : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.guardian_name ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 text-slate-700">{s.guardian_phone ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/students/${s.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-blue-700 hover:bg-blue-50"
                    >
                      <Eye className="w-4 h-4" /> View
                    </Link>
                    {canDelete && (
                      <button
                        onClick={() => remove(s.id, `${s.first_name} ${s.last_name}`)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-700 hover:bg-red-50 ml-1"
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

        {data && data.total > pageSize && (
          <div className="px-4 py-3 border-t border-slate-100 flex justify-between items-center text-sm">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={classNames('px-3 py-1 rounded border border-slate-200', page === 1 ? 'opacity-50' : 'hover:bg-slate-50')}
            >
              Previous
            </button>
            <div className="text-xs text-slate-500">Page {page} of {Math.ceil(data.total / pageSize)}</div>
            <button
              disabled={page * pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
              className={classNames('px-3 py-1 rounded border border-slate-200', page * pageSize >= data.total ? 'opacity-50' : 'hover:bg-slate-50')}
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}