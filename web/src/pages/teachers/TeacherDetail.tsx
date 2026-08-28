import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader, Card, Badge, Button } from '../../components/ui';
import { formatDate } from '../../lib/format';

interface TeacherDetail {
  user_id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  last_login_at: string | null;
  employee_code: string | null;
  qualification: string | null;
  joining_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  subject_count: number;
  class_count: number;
  subjects: { id: string; code: string; name: string; status: string; class_name: string }[];
  classes_led: { id: string; name: string }[];
}

export default function TeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: teacher, isLoading } = useQuery<TeacherDetail>({
    queryKey: ['teacher', id],
    queryFn: () => api.get(`/teachers/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-slate-400">Loading...</div>;
  if (!teacher) return <div className="p-8 text-slate-400">Teacher not found.</div>;

  return (
    <div>
      <PageHeader
        title={teacher.full_name}
        description={`@${teacher.username} · ${teacher.qualification ?? 'No qualification set'}`}
        actions={
          <Button variant="secondary" onClick={() => navigate('/teachers')}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-5">
          <div className="text-sm text-slate-500">Subjects taught</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{teacher.subject_count}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Classes as class teacher</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{teacher.class_count}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Status</div>
          <div className="mt-1">
            <Badge variant={teacher.status === 'active' ? 'success' : 'default'}>{teacher.status}</Badge>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Profile</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Employee Code" value={teacher.employee_code ?? '—'} />
            <Field label="Full Name" value={teacher.full_name} />
            <Field label="Username" value={teacher.username} />
            <Field label="Qualification" value={teacher.qualification ?? '—'} />
            <Field label="Email" value={teacher.email ?? '—'} />
            <Field label="Phone" value={teacher.phone ?? '—'} />
            <Field label="Joining Date" value={formatDate(teacher.joining_date)} />
            <Field label="Last Login" value={formatDate(teacher.last_login_at)} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-3">
              Subjects Taught ({teacher.subjects.length})
            </h2>
            {teacher.subjects.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">No subject allocations.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {teacher.subjects.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.class_name} · {s.code}</div>
                    </div>
                    <Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-3">
              Classes as Class Teacher ({teacher.classes_led.length})
            </h2>
            {teacher.classes_led.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">Not a class teacher.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {teacher.classes_led.map((c) => (
                  <Link
                    key={c.id}
                    to={`/classes`}
                    className="block py-2 text-sm text-slate-700 hover:text-blue-600"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
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
