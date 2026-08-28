import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, HardDrive, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Modal, EmptyState, Badge, useToasts,
} from '../components/ui';
import { useAuthStore } from '../store/auth';
import { formatBytes, formatRelative } from '../lib/format';
import { downloadFile } from '../lib/api';

interface BackupFile {
  filename: string;
  kind: 'db' | 'data';
  size_bytes: number;
  modified_at: string;
}

export default function BackupManagement() {
  const isAdmin = useAuthStore((s) => s.hasPerm('system.admin'));
  const qc = useQueryClient();
  const { show, node } = useToasts();

  const { data, isFetching, refetch } = useQuery<{ items: BackupFile[]; backups_dir: string; retention: number }>({
    queryKey: ['backups'],
    queryFn: () => api.get('/backups'),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });

  const [running, setRunning] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Backup & Restore" />
        <EmptyState title="Admin access required" description="system.admin permission is required." />
      </div>
    );
  }

  const triggerBackup = async () => {
    setRunning(true);
    try {
      const r = await api.post<{ ok: boolean; result: { totalBytes: number; errors: string[] } }>('/backups');
      const msg = r.result.errors.length
        ? `Backup finished with ${r.result.errors.length} error(s)`
        : `Backup complete: ${(r.result.totalBytes / 1024).toFixed(1)} KB`;
      show(msg, r.result.errors.length ? 'error' : 'success');
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['health'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const doRestore = async () => {
    if (!restoreTarget || confirmText !== 'RESTORE') return;
    setRestoreBusy(true);
    try {
      const r = await api.post<{ ok: boolean; restart_required: boolean }>(
        `/backups/${restoreTarget.filename}/restore`,
        { confirm: 'RESTORE', kind: restoreTarget.kind },
      );
      show(
        r.restart_required
          ? `Restored ${restoreTarget.filename}. Restart the server to load it.`
          : `Restored ${restoreTarget.filename}.`,
        'success',
      );
      setRestoreTarget(null);
      setConfirmText('');
      qc.invalidateQueries({ queryKey: ['health'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setRestoreBusy(false);
    }
  };

  const items = data?.items ?? [];
  const dbCount = items.filter((i) => i.kind === 'db').length;

  return (
    <div>
      {node}
      <PageHeader
        title="Backup & Restore"
        description={`${items.length} file(s) · retention ${data?.retention ?? 14} runs`}
        actions={
          <>
            <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={triggerBackup} disabled={running}>
              <HardDrive className="w-4 h-4" />
              {running ? 'Backing up…' : 'Backup now'}
            </Button>
          </>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No backups yet"
          description="Click Backup now to take the first snapshot."
          action={<Button onClick={triggerBackup} disabled={running}>Backup now</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-4">File</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4">Size</th>
                  <th className="py-2 px-4">Modified</th>
                  <th className="py-2 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.filename} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-4 font-mono text-xs text-slate-800">{b.filename}</td>
                    <td className="py-2 px-4">
                      <Badge variant={b.kind === 'db' ? 'info' : 'default'}>{b.kind}</Badge>
                    </td>
                    <td className="py-2 px-4 text-slate-700">{formatBytes(b.size_bytes)}</td>
                    <td className="py-2 px-4 text-slate-600">{formatRelative(b.modified_at)}</td>
                    <td className="py-2 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(`/backups/${b.filename}/download`, b.filename)}
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setRestoreTarget(b); setConfirmText(''); }}
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={restoreTarget !== null}
        onClose={() => { if (!restoreBusy) { setRestoreTarget(null); setConfirmText(''); } }}
        title="Restore from backup"
        size="md"
      >
        {restoreTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <ShieldAlert className="w-4 h-4 flex-none mt-0.5" />
              <div>
                <div className="font-medium">This will overwrite the current database.</div>
                <div className="text-amber-700">
                  File <code className="font-mono">{restoreTarget.filename}</code> ({formatBytes(restoreTarget.size_bytes)}, {restoreTarget.kind}).
                  {restoreTarget.kind === 'db' && ' A server restart is required after restore.'}
                </div>
              </div>
            </div>
            <label className="block">
              <div className="text-sm font-medium text-slate-700 mb-1">
                Type <code className="font-mono text-slate-900">RESTORE</code> to confirm
              </div>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="RESTORE"
                autoFocus
                disabled={restoreBusy}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => { setRestoreTarget(null); setConfirmText(''); }}
                disabled={restoreBusy}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={doRestore}
                disabled={confirmText !== 'RESTORE' || restoreBusy}
              >
                {restoreBusy ? 'Restoring…' : 'Restore'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <p className="text-xs text-slate-400 mt-6">
        {dbCount} database snapshot(s) on disk · nightly cron at 02:00 · retention {data?.retention ?? 14} runs.
      </p>
    </div>
  );
}
