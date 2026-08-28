import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import { Users, Wallet, AlertCircle, GraduationCap } from 'lucide-react';
import { api } from '../lib/api';
import { Card, PageHeader, Stat, Badge, useToasts } from '../components/ui';
import { formatMoney } from '../lib/format';
import { useSse } from '../lib/sse';

interface Summary {
  totals: { students: number; classes: number; staff: number };
  attendance_today: { sessions: number; present: number; absent: number; leave: number };
  fees_today: { today_collected: number; mtd_collected: number; outstanding: number };
  attendance_trend: { date: string; present: number; absent: number }[];
  recent_events: { id: string; level: string; source: string; message: string; created_at: string }[];
}

export default function Dashboard() {
  const { show, node } = useToasts();
  const { data, refetch, isLoading } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary'),
  });

  useSse((event, payload) => {
    if (event === 'broadcast' && payload && typeof payload === 'object') {
      const p = payload as { type?: string };
      if (['fees.payment_recorded', 'attendance.saved', 'fees.invoices_generated', 'backup.completed'].includes(p.type ?? '')) {
        refetch();
        if (p.type === 'fees.payment_recorded') show('Fee payment recorded', 'success');
      }
    }
  });

  const today = data?.attendance_today;
  const todayPresentPct = today && (today.present + today.absent + today.leave) > 0
    ? Math.round((today.present / (today.present + today.absent + today.leave)) * 100)
    : null;

  return (
    <div>
      {node}
      <PageHeader title="Dashboard" description="Live overview of attendance, fees, and system activity" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Active Students"
          value={data?.totals.students ?? '—'}
          hint="Total enrolled and active"
        />
        <Stat
          label="Today's Attendance"
          value={todayPresentPct !== null ? `${todayPresentPct}%` : '—'}
          hint={today ? `${today.present} present / ${today.absent} absent / ${today.leave} on leave` : 'No data yet'}
          tone="success"
        />
        <Stat
          label="Fees Collected MTD"
          value={data ? formatMoney(data.fees_today.mtd_collected) : '—'}
          hint={data ? `${formatMoney(data.fees_today.today_collected)} today` : ''}
          tone="success"
        />
        <Stat
          label="Outstanding Fees"
          value={data ? formatMoney(data.fees_today.outstanding) : '—'}
          hint="Across all unpaid invoices"
          tone="warning"
        />
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-slate-900">Attendance trend</div>
              <div className="text-xs text-slate-500">Last 14 days</div>
            </div>
            <Badge variant="info">Live</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data?.attendance_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} name="Present" />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name="Absent" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-semibold text-slate-900 mb-2">Recent events</div>
          <div className="text-xs text-slate-500 mb-3">Latest system events</div>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {(data?.recent_events ?? []).length === 0 && (
              <li className="text-sm text-slate-400">No events yet.</li>
            )}
            {(data?.recent_events ?? []).map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <Badge
                  variant={
                    e.level === 'error' || e.level === 'critical' ? 'danger' :
                    e.level === 'warning' ? 'warning' : 'default'
                  }
                >
                  {e.level}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 truncate">{e.message}</div>
                  <div className="text-xs text-slate-400">{e.source} · {new Date(e.created_at).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <div>
              <div className="text-sm text-slate-500">Staff</div>
              <div className="text-xl font-semibold">{data?.totals.staff ?? '—'}</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center"><GraduationCap className="w-5 h-5" /></div>
            <div>
              <div className="text-sm text-slate-500">Classes</div>
              <div className="text-xl font-semibold">{data?.totals.classes ?? '—'}</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
            <div>
              <div className="text-sm text-slate-500">Today's collection</div>
              <div className="text-xl font-semibold">{data ? formatMoney(data.fees_today.today_collected) : '—'}</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center"><AlertCircle className="w-5 h-5" /></div>
            <div>
              <div className="text-sm text-slate-500">Today's absent</div>
              <div className="text-xl font-semibold">{today?.absent ?? '—'}</div>
            </div>
          </div>
        </Card>
      </div>

      {isLoading && <div className="text-xs text-slate-400 mt-3">Loading...</div>}
    </div>
  );
}