import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Table, Badge, useToasts, EmptyState,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDateTime, timeAgo } from '../../lib/format';

interface Notif {
  id: string;
  kind: 'info' | 'warning' | 'success' | 'alert' | 'task' | 'fee' | 'attendance' | 'exam';
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const KIND_VARIANT: Record<Notif['kind'], 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  info: 'info', warning: 'warning', success: 'success', alert: 'danger',
  task: 'default', fee: 'warning', attendance: 'info', exam: 'success',
};

export default function Notifications() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('notifications.read'));
  const { show, node } = useToasts();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data = { items: [] as Notif[], unread: 0 }, isLoading } = useQuery<{ items: Notif[]; unread: number }>({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => api.get(`/notifications${unreadOnly ? '?unread=true' : ''}`),
  });

  const markRead = async (n: Notif) => {
    if (n.read_at) return;
    try {
      await api.post('/notifications/mark-read', { ids: [n.id] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const markAll = async () => {
    try {
      await api.post('/notifications/mark-read', { all: true });
      show('All marked read', 'success');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (n: Notif) => {
    try {
      await api.delete(`/notifications/${n.id}`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Notifications"
        description={`${data.unread} unread of ${data.items.length}`}
        actions={
          canWrite && data.unread > 0 && (
            <Button variant="secondary" onClick={markAll}><CheckCheck className="w-4 h-4" /> Mark all read</Button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title={unreadOnly ? 'No unread notifications' : 'No notifications'}
            description={unreadOnly ? 'You are all caught up!' : 'Notifications will appear here when there is activity.'}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 ${!n.read_at ? 'bg-blue-50/30' : ''}`}
              >
                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center ${
                  !n.read_at ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{n.title}</span>
                    <Badge variant={KIND_VARIANT[n.kind]}>{n.kind}</Badge>
                  </div>
                  {n.body && <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>}
                  <div className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)} · {formatDateTime(n.created_at)}</div>
                </div>
                <div className="flex items-center gap-1">
                  {n.link && (
                    <a href={n.link} className="text-xs text-blue-600 hover:underline px-2">Open</a>
                  )}
                  {!n.read_at && (
                    <button onClick={() => markRead(n)} title="Mark read" className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => remove(n)} title="Delete" className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
