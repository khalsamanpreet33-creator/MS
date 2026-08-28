import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Users, Wallet, BookCheck, Activity, TrendingUp } from 'lucide-react';
import { api } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Table, Badge, EmptyState,
} from '../../components/ui';
import { formatMoney } from '../../lib/format';

type ReportKey = 'attendance' | 'fees' | 'outstanding' | 'strength' | 'dashboard';

interface AttRow { status: string; n: number }
interface AttClassRow { class_name: string; section_name: string; status: string; n: number }
interface FeeModeRow { payment_mode: string; total: number; n: number }
interface OutstandingRow { invoice_number: string; admission_no: string; first_name: string; last_name: string; class_name: string; section_name: string; balance: number; due_date: string; status: string }
interface StrengthRow { class_name: string; section_name: string; capacity: number; enrolled: number }

function today(): string { return new Date().toISOString().slice(0, 10); }
function monthStart(): string { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [report, setReport] = useState<ReportKey>('dashboard');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const { data: dash } = useQuery({
    queryKey: ['report-dashboard'],
    queryFn: () => api.get<{ students: number; staff: number; today_collected: number; today_attendance: AttRow[]; active_notices: number; open_complaints: number; today: string }>('/reports/dashboard'),
  });

  const { data: att } = useQuery({
    queryKey: ['report-att', from, to],
    queryFn: () => api.get<{ total: number; by_status: AttRow[]; by_class: AttClassRow[] }>(`/reports/attendance?from=${from}&to=${to}`),
    enabled: report === 'attendance',
  });

  const { data: fees } = useQuery({
    queryKey: ['report-fees', from, to],
    queryFn: () => api.get<{ paid: { total: number; n: number }; outstanding: { total: number; n: number }; by_mode: FeeModeRow[] }>(`/reports/fees?from=${from}&to=${to}`),
    enabled: report === 'fees',
  });

  const { data: outstanding } = useQuery({
    queryKey: ['report-outstanding'],
    queryFn: () => api.get<{ items: OutstandingRow[]; total: number }>('/reports/fees/outstanding'),
    enabled: report === 'outstanding',
  });

  const { data: strength } = useQuery({
    queryKey: ['report-strength'],
    queryFn: () => api.get<{ items: StrengthRow[] }>('/reports/students/strength'),
    enabled: report === 'strength',
  });

  const exportAttendance = () => {
    if (!att) return;
    downloadCsv('attendance.csv', ['Class', 'Section', 'Status', 'Count'],
      att.by_class.map((r) => [r.class_name, r.section_name ?? '-', r.status, r.n]));
  };
  const exportOutstanding = () => {
    if (!outstanding) return;
    downloadCsv('outstanding.csv', ['Invoice', 'Adm No', 'Student', 'Class', 'Section', 'Due Date', 'Balance', 'Status'],
      outstanding.items.map((r) => [r.invoice_number, r.admission_no, `${r.first_name} ${r.last_name}`,
        r.class_name ?? '-', r.section_name ?? '-', r.due_date, r.balance, r.status]));
  };
  const exportStrength = () => {
    if (!strength) return;
    downloadCsv('student-strength.csv', ['Class', 'Section', 'Capacity', 'Enrolled'],
      strength.items.map((r) => [r.class_name, r.section_name ?? '-', r.capacity, r.enrolled]));
  };

  return (
    <div>
      <PageHeader title="Reports" description="Pre-built reports and dashboards" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <ReportBtn active={report === 'dashboard'} onClick={() => setReport('dashboard')} icon={Activity} label="Dashboard" />
        <ReportBtn active={report === 'attendance'} onClick={() => setReport('attendance')} icon={BookCheck} label="Attendance" />
        <ReportBtn active={report === 'fees'} onClick={() => setReport('fees')} icon={Wallet} label="Fee Collection" />
        <ReportBtn active={report === 'outstanding'} onClick={() => setReport('outstanding')} icon={TrendingUp} label="Outstanding" />
        <ReportBtn active={report === 'strength'} onClick={() => setReport('strength')} icon={Users} label="Student Strength" />
      </div>

      {(report === 'attendance' || report === 'fees') && (
        <Card className="mb-4">
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </Card>
      )}

      {report === 'dashboard' && dash && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat icon={Users} label="Active Students" value={dash.students} />
          <Stat icon={Users} label="Staff" value={dash.staff} />
          <Stat icon={Wallet} label="Today Collected" value={formatMoney(dash.today_collected)} />
          <Stat icon={FileText} label="Active Notices" value={dash.active_notices} />
          <Stat icon={Activity} label="Open Complaints" value={dash.open_complaints} />
        </div>
      )}

      {report === 'attendance' && att && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Summary ({att.total} records)</h3>
              <Button variant="secondary" onClick={exportAttendance}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
            {att.by_status.length === 0 ? <EmptyState title="No data" /> :
              <Table>
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {att.by_status.map((r) => (
                    <tr key={r.status} className="border-t border-slate-100">
                      <td className="px-4 py-3"><Badge variant={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : 'warning'}>{r.status}</Badge></td>
                      <td className="px-4 py-3 text-sm font-medium">{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
          </Card>
          <Card>
            <h3 className="font-semibold mb-3">By Class / Section</h3>
            {att.by_class.length === 0 ? <EmptyState title="No data" /> :
              <Table>
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {att.by_class.map((r, i) => (
                    <tr key={`${r.class_name}-${r.section_name}-${r.status}-${i}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm">{r.class_name}</td>
                      <td className="px-4 py-3 text-sm">{r.section_name ?? '-'}</td>
                      <td className="px-4 py-3"><Badge variant={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : 'warning'}>{r.status}</Badge></td>
                      <td className="px-4 py-3 text-sm font-medium">{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
          </Card>
        </div>
      )}

      {report === 'fees' && fees && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Wallet} label="Collected in range" value={formatMoney(fees.paid.total)} subtitle={`${fees.paid.n} payments`} />
            <Stat icon={TrendingUp} label="Total Outstanding" value={formatMoney(fees.outstanding.total)} subtitle={`${fees.outstanding.n} invoices`} />
          </div>
          <Card>
            <h3 className="font-semibold mb-3">By Payment Mode</h3>
            {fees.by_mode.length === 0 ? <EmptyState title="No data" /> :
              <Table>
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Count</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.by_mode.map((r) => (
                    <tr key={r.payment_mode} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm">{r.payment_mode}</td>
                      <td className="px-4 py-3 text-sm">{r.n}</td>
                      <td className="px-4 py-3 text-sm font-medium">{formatMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            }
          </Card>
        </div>
      )}

      {report === 'outstanding' && outstanding && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Outstanding Dues</h3>
              <div className="text-sm text-slate-600">Total: <span className="font-semibold text-red-600">{formatMoney(outstanding.total)}</span> · {outstanding.items.length} invoice(s)</div>
            </div>
            <Button variant="secondary" onClick={exportOutstanding}><Download className="w-4 h-4" /> Export CSV</Button>
          </div>
          {outstanding.items.length === 0 ? <EmptyState title="No outstanding" description="All invoices are paid." /> :
            <Table>
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.items.map((r) => (
                  <tr key={r.invoice_number} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono">{r.invoice_number}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>{r.first_name} {r.last_name}</div>
                      <div className="text-xs text-slate-500 font-mono">{r.admission_no}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{[r.class_name, r.section_name].filter(Boolean).join(' / ')}</td>
                    <td className="px-4 py-3 text-sm">{r.due_date}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatMoney(r.balance)}</td>
                    <td className="px-4 py-3"><Badge variant={r.status === 'overdue' ? 'danger' : 'warning'}>{r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
        </Card>
      )}

      {report === 'strength' && strength && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Student Strength by Class</h3>
            <Button variant="secondary" onClick={exportStrength}><Download className="w-4 h-4" /> Export CSV</Button>
          </div>
          {strength.items.length === 0 ? <EmptyState title="No data" /> :
            <Table>
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {strength.items.map((r, i) => {
                  const pct = r.capacity ? Math.round((r.enrolled / r.capacity) * 100) : 0;
                  return (
                    <tr key={`${r.class_name}-${r.section_name}-${i}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm font-medium">{r.class_name}</td>
                      <td className="px-4 py-3 text-sm">{r.section_name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm">{r.capacity}</td>
                      <td className="px-4 py-3 text-sm font-medium">{r.enrolled}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded">
                            <div className={`h-2 rounded ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
        </Card>
      )}
    </div>
  );
}

function ReportBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button onClick={onClick} className={`p-4 rounded-lg border text-left transition ${active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-500'}`} />
        <span className={`font-medium text-sm ${active ? 'text-blue-900' : 'text-slate-700'}`}>{label}</span>
      </div>
    </button>
  );
}

function Stat({ icon: Icon, label, value, subtitle }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; subtitle?: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-blue-600">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
        </div>
      </div>
    </Card>
  );
}
