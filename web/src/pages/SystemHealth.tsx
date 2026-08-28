import { useQuery } from '@tanstack/react-query';
import { Activity, Database, HardDrive, Inbox, RefreshCw, Send } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Card, Stat, Badge, Button, EmptyState } from '../components/ui';
import { useSse } from '../lib/sse';
import { useAuthStore } from '../store/auth';
import { formatBytes, formatRelative } from '../lib/format';

interface Automation {
  id: string;
  name: string;
  cron_expr: string;
  handler: string;
  is_enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
}

interface Health {
  status: string;
  server_time: string;
  db: { path: string; size_bytes: number };
  storage: { school_data_dir: string; backups_dir: string; free_bytes: number };
  backup: { last_at: string | null; message: string | null };
  automations: Automation[];
  outbox: { queued: number; failed: number };
}

export default function SystemHealth() {
  const isAdmin = useAuthStore((s) => s.hasPerm('system.admin'));

  const { data, refetch, isFetching, isError } = useQuery<Health>({
    queryKey: ['health'],
    queryFn: () => api.get('/health'),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  useSse((event, payload) => {
    if (event !== 'broadcast' || !payload || typeof payload !== 'object') return;
    const t = (payload as { type?: string }).type;
    if (t === 'backup.completed' || t === 'fees.payment_recorded' || t === 'attendance.saved') {
      refetch();
    }
  });

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="System Health" />
        <EmptyState
          title="Admin access required"
          description="This page is restricted to users with system.admin permission."
        />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div>
        <PageHeader
          title="System Health"
          actions={<Button onClick={() => refetch()}><RefreshCw className="w-4 h-4" /> Retry</Button>}
        />
        <EmptyState title="Could not load health endpoint" description="GET /api/health did not respond." />
      </div>
    );
  }

  const backupAgeDays = data.backup.last_at
    ? Math.floor((Date.now() - new Date(data.backup.last_at + 'Z').getTime()) / 86_400_000)
    : null;

  return (
    <div>
      <PageHeader
        title="System Health"
        description="Live status of the school-erp server"
        actions={
          <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing' : 'Refresh'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Server"
          value={<span className="capitalize">{data.status}</span>}
          hint={new Date(data.server_time).toLocaleString()}
          tone={data.status === 'ok' ? 'success' : 'danger'}
        />
        <Stat
          label="Database"
          value={formatBytes(data.db.size_bytes)}
          hint={data.db.path}
        />
        <Stat
          label="Disk free"
          value={formatBytes(data.storage.free_bytes)}
          hint={data.storage.backups_dir}
          tone={data.storage.free_bytes < 500 * 1024 * 1024 ? 'warning' : 'default'}
        />
        <Stat
          label="Last backup"
          value={
            data.backup.last_at
              ? backupAgeDays === 0
                ? 'today'
                : `${backupAgeDays}d ago`
              : 'never'
          }
          hint={data.backup.message ?? 'No backup recorded'}
          tone={backupAgeDays === null || backupAgeDays > 1 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Outbox</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Queued</div>
              <div className="text-2xl font-semibold text-slate-900">{data.outbox.queued}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Failed</div>
              <div className={`text-2xl font-semibold ${data.outbox.failed ? 'text-red-700' : 'text-slate-900'}`}>
                {data.outbox.failed}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Messages flush every 5 minutes. Failed messages stay in the queue until a provider is wired in.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Storage</h2>
          </div>
          <div className="text-sm space-y-1">
            <Row label="school-data" value={data.storage.school_data_dir} mono />
            <Row label="backups" value={data.storage.backups_dir} mono />
            <Row label="free" value={formatBytes(data.storage.free_bytes)} />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Scheduled jobs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Cron</th>
                  <th className="py-2 pr-3">Handler</th>
                  <th className="py-2 pr-3">Last run</th>
                  <th className="py-2">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {data.automations.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800">{a.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">{a.cron_expr}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-500">{a.handler}</td>
                    <td className="py-2 pr-3 text-slate-600">{formatRelative(a.last_run_at)}</td>
                    <td className="py-2">
                      <Badge variant={a.is_enabled ? 'success' : 'default'}>
                        {a.is_enabled ? 'on' : 'off'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-400 mt-6 flex items-center gap-1">
        <Send className="w-3 h-3" /> Auto-refreshes on backup completed / payment / attendance saved events.
        Manual refresh hits <code className="font-mono">GET /api/health</code>.
      </p>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-500 w-28 flex-none">{label}</span>
      <span className={`text-slate-800 truncate ${mono ? 'font-mono text-xs' : ''}`} title={value}>
        {value}
      </span>
    </div>
  );
}
