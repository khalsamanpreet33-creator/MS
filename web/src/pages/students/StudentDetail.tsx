import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../../lib/api';
import {
  PageHeader, Card, Button, Badge, FormField, Select, Input,
} from '../../components/ui';
import { formatDate, formatMoney } from '../../lib/format';
import { downloadFile } from '../../lib/api';

interface StudentDetail {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  joining_date: string | null;
  class_name: string | null;
  section_name: string | null;
  status: string;
}

interface ClassItem { id: string; name: string; }

interface SectionItem { id: string; name: string; class_id: string; }

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: student, isLoading } = useQuery<StudentDetail>({
    queryKey: ['student', id],
    queryFn: () => api.get(`/students/${id}`),
  });

  const { data: history } = useQuery<{ items: unknown[] }>({
    queryKey: ['student-history', id],
    queryFn: () => api.get(`/students/${id}/history`),
  });

  const { data: attendance } = useQuery<{ items: { date: string; status: string; remarks: string | null }[] }>({
    queryKey: ['student-attendance', id],
    queryFn: () => api.get(`/attendance/students/${id}?from=2025-01-01`),
  });

  const { data: balance } = useQuery<{ balance: number; total_due: number; total_paid: number }>({
    queryKey: ['student-balance', id],
    queryFn: () => api.get(`/fees/student-balance/${id}`),
  });

  const { data: payments } = useQuery<{ items: { id: string; receipt_no: string; amount: number; payment_date: string; payment_mode: string }[] }>({
    queryKey: ['student-payments', id],
    queryFn: () => api.get(`/fees/payments?studentId=${id}`),
  });

  const [tab, setTab] = useState<'profile' | 'attendance' | 'fees' | 'history'>('profile');

  if (isLoading) return <div className="text-slate-400">Loading...</div>;
  if (!student) return <div className="text-slate-400">Student not found.</div>;

  return (
    <div>
      <PageHeader
        title={`${student.first_name} ${student.last_name}`}
        description={`Admission No ${student.admission_no} · ${student.class_name ?? '—'} / ${student.section_name ?? '—'}`}
        actions={
          <Button variant="secondary" onClick={() => navigate('/students')}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['profile', 'attendance', 'fees', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <Card className="p-5 grid md:grid-cols-2 gap-4">
          <Field label="Admission No" value={student.admission_no} />
          <Field label="Status" value={<Badge variant={student.status === 'active' ? 'success' : 'default'}>{student.status}</Badge>} />
          <Field label="Date of birth" value={formatDate(student.date_of_birth)} />
          <Field label="Gender" value={student.gender ?? '—'} />
          <Field label="Blood group" value={student.blood_group ?? '—'} />
          <Field label="Joining date" value={formatDate(student.joining_date)} />
          <Field label="Class" value={`${student.class_name ?? '—'} / ${student.section_name ?? '—'}`} />
          <Field label="Address" value={student.address ?? '—'} />
          <Field label="Guardian" value={student.guardian_name ?? '—'} />
          <Field label="Phone" value={student.guardian_phone ?? '—'} />
          <div className="md:col-span-2">
            <Link to={`/students/${student.id}/edit`} className="text-blue-700 hover:underline text-sm">Edit profile →</Link>
          </div>
        </Card>
      )}

      {tab === 'attendance' && (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Remarks</th></tr>
            </thead>
            <tbody>
              {(attendance?.items ?? []).map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2">{r.date}</td>
                  <td className="px-4 py-2">
                    <Badge variant={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : 'warning'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.remarks ?? '—'}</td>
                </tr>
              ))}
              {(attendance?.items ?? []).length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No attendance records.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'fees' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="text-sm text-slate-500">Total due</div>
              <div className="text-2xl font-semibold">{formatMoney(balance?.total_due ?? 0)}</div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-slate-500">Total paid</div>
              <div className="text-2xl font-semibold text-emerald-700">{formatMoney(balance?.total_paid ?? 0)}</div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-slate-500">Balance</div>
              <div className="text-2xl font-semibold text-amber-700">{formatMoney(balance?.balance ?? 0)}</div>
            </Card>
          </div>
          <Card>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {(payments?.items ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs">{p.receipt_no}</td>
                    <td className="px-4 py-2">{p.payment_date}</td>
                    <td className="px-4 py-2 uppercase">{p.payment_mode}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(p.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => downloadFile(`/fees/receipts/${p.id}?format=pdf`, `${p.receipt_no}.pdf`)}
                        className="text-blue-700 hover:underline text-xs"
                      >
                        <Printer className="w-3 h-3 inline" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {(payments?.items ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No payments yet.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {((history?.items ?? []) as { academic_year: string; class_name: string | null; section_name: string | null; action: string; result: string | null }[]).map((h, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2">{h.academic_year}</td>
                  <td className="px-4 py-2">{h.class_name ?? '—'}</td>
                  <td className="px-4 py-2">{h.section_name ?? '—'}</td>
                  <td className="px-4 py-2 capitalize">{h.action}</td>
                  <td className="px-4 py-2">{h.result ?? '—'}</td>
                </tr>
              ))}
              {(history?.items ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No history yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
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