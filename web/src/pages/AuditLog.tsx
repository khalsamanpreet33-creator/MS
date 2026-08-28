import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter, X } from 'lucide-react';
import { api } from '../lib/api';
import {
  PageHeader, Card, Button, Input, Select, EmptyState, Badge,
} from '../components/ui';
import { useAuthStore } from '../store/auth';
import { formatRelative, formatDate } from '../lib/format';

interface AuditItem {
  id: string;
  actor_id: string | null;
  username: string | null;
  full_name: string | null;
  route: string;
  method: string;
  status: number;
  ip: string | null;
  created_at: string;
}

interface AuditPage {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
}

interface Actor {
  id: string;
  username: string;
  full_name: string;
}

const METHODS = ['', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
const STATUS_CLASSES = ['', '2xx', '4xx', '5xx'] as const;

export default function AuditLog() {
  const canRead = useAuthStore((s) => s.hasPerm('audit.read'));

  const [actorId, setActorId] = useState('');
  const [method, setMethod] = useState<string>('');
  const [statusClass, setStatusClass] = useState<string>('');
  const [routeContains, setRouteContains] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const query = {
    ...(actorId ? { actor_id: actorId } : {}),
    ...(method ? { method } : {}),
    ...(statusClass ? { status_class: statusClass } : {}),
    ...(routeContains ? { route_contains: routeContains } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    limit, offset,
  };

  const { data, isLoading } = useQuery<AuditPage>({
    queryKey: ['audit', query],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== '' && v !== 0) params.set(k, String(v));
      }
      const qs = params.toString();
      return api.get<AuditPage>(`/audit${qs ? `?${qs}` : ''}`);
    },
    enabled: canRead,
  });

  const { data: actorsData } = useQuery<{ items: Actor[] }>({
    queryKey: ['audit-actors'],
    queryFn: () => api.get('/audit/actors'),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Audit Log" />
        <EmptyState title="Permission required" description="audit.read permission is required to view this page." />
      </div>
    );
  }

  const reset = () => {
    setActorId(''); setMethod(''); setStatusClass(''); setRouteContains('');
    setFrom(''); setTo(''); setOffset(0);
  };

  const csvHref = `/api/audit/csv?${new URLSearchParams(
    Object.entries(query).filter(([_, v]) => v !== '' && v !== 0) as [string, string][],
  ).toString()}`;

  const total = data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description={`${total.toLocaleString()} event(s) recorded`}
        actions={
          <a href={csvHref} download>
            <Button variant="secondary">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </a>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
          <button
            onClick={reset}
            className="ml-auto text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Actor</div>
            <Select value={actorId} onChange={(e) => { setActorId(e.target.value); setOffset(0); }}>
              <option value="">Any</option>
              {(actorsData?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.full_name} ({a.username})</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Method</div>
            <Select value={method} onChange={(e) => { setMethod(e.target.value); setOffset(0); }}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m || 'Any'}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Status class</div>
            <Select value={statusClass} onChange={(e) => { setStatusClass(e.target.value); setOffset(0); }}>
              {STATUS_CLASSES.map((s) => (
                <option key={s} value={s}>{s || 'Any'}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Route contains</div>
            <Input
              value={routeContains}
              onChange={(e) => { setRouteContains(e.target.value); setOffset(0); }}
              placeholder="/students"
            />
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">From</div>
            <Input type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} />
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">To</div>
            <Input type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} />
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Page size</div>
            <Select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}>
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {isLoading && !data ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No audit events"
          description="Adjust filters or wait for state-changing activity."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-4">When</th>
                  <th className="py-2 px-4">Actor</th>
                  <th className="py-2 px-4">Method</th>
                  <th className="py-2 px-4">Route</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">IP</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-4 text-slate-600" title={formatDate(row.created_at)}>
                      {formatRelative(row.created_at)}
                    </td>
                    <td className="py-2 px-4 text-slate-800">
                      {row.full_name || row.username || <span className="text-slate-400">anonymous</span>}
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant={methodTone(row.method)}>{row.method}</Badge>
                    </td>
                    <td className="py-2 px-4 font-mono text-xs text-slate-700">{row.route}</td>
                    <td className="py-2 px-4">
                      <Badge variant={statusTone(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="py-2 px-4 text-slate-500 font-mono text-xs">{row.ip ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              {pageStart}–{pageEnd} of {total.toLocaleString()}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pageEnd >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function methodTone(m: string): 'default' | 'info' | 'warning' | 'danger' | 'success' {
  switch (m) {
    case 'POST': return 'info';
    case 'PATCH': return 'warning';
    case 'PUT': return 'warning';
    case 'DELETE': return 'danger';
    default: return 'default';
  }
}

function statusTone(s: number): 'default' | 'success' | 'warning' | 'danger' {
  if (s >= 200 && s < 300) return 'success';
  if (s >= 300 && s < 400) return 'default';
  if (s >= 400 && s < 500) return 'warning';
  return 'danger';
}
