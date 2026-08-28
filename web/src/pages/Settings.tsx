import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Shield, Building2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import {
  PageHeader, Card, Button, FormField, Input, useToasts,
  EmptyState, Badge,
} from '../components/ui';
import { useAuthStore } from '../store/auth';

interface SettingRow {
  value: string;
  updated_at: string;
  editable: boolean;
}

interface SettingsPayload {
  settings: Record<string, SettingRow>;
  editable_keys: string[];
  system: {
    backup_retention_runs: number;
    system_events_retention_days: number;
    outbox_flush_interval_ms: number;
    jwt_ttl_seconds: number;
    upload_max_bytes: number;
  };
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  user_count: number;
  permissions: string[];
}

interface RolesPayload {
  roles: Role[];
  permissions: { key: string; description: string | null }[];
}

type Tab = 'profile' | 'system' | 'roles';

export default function Settings() {
  const isAdmin = useAuthStore((s) => s.hasPerm('system.admin'));
  const [tab, setTab] = useState<Tab>('profile');

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState
          title="Admin access required"
          description="Settings are restricted to users with system.admin permission."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="School profile, system config, and role overview" />
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {(['profile', 'system', 'roles'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'system' && <SystemTab />}
      {tab === 'roles' && <RolesTab />}
    </div>
  );
}

const FIELD_META: { key: string; label: string; type?: string; placeholder?: string; hint?: string }[] = [
  { key: 'school.name', label: 'School name' },
  { key: 'school.address', label: 'Address' },
  { key: 'school.phone', label: 'Phone', placeholder: '+91 00000 00000' },
  { key: 'school.email', label: 'Email', type: 'email', placeholder: 'info@school.example' },
  { key: 'school.academic_year', label: 'Academic year', placeholder: '2025-2026', hint: 'Format: YYYY-YYYY' },
  { key: 'currency.code', label: 'Currency code', placeholder: 'INR', hint: 'ISO 4217 (3 or 4 letters)' },
  { key: 'currency.symbol', label: 'Currency symbol', placeholder: '₹' },
];

function ProfileTab() {
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const { data, isLoading } = useQuery<SettingsPayload>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    const initial: Record<string, string> = {};
    for (const k of data.editable_keys) {
      initial[k] = data.settings[k]?.value ?? '';
    }
    setForm(initial);
    setDirty(false);
  }, [data]);

  const set = (k: string, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    const updates = data.editable_keys
      .filter((k) => form[k] !== data.settings[k]?.value)
      .map((k) => ({ key: k, value: form[k] ?? '' }));
    if (updates.length === 0) {
      show('Nothing to save', 'info');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/settings', { updates });
      show(`Saved ${updates.length} setting(s)`, 'success');
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) {
    return <div className="text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div>
      {node}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">School profile</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELD_META.map((f) => (
            <FormField key={f.key} label={f.label} hint={f.hint}>
              <Input
                type={f.type ?? 'text'}
                value={form[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </FormField>
          ))}
        </div>
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {dirty ? 'Unsaved changes' : 'Up to date'}
          </div>
          <Button onClick={save} disabled={saving || !dirty}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SystemTab() {
  const { data } = useQuery<SettingsPayload>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
  });

  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;

  const rows: { label: string; value: string; hint?: string }[] = [
    {
      label: 'Backup retention',
      value: `${data.system.backup_retention_runs} runs`,
      hint: 'Older backup files are deleted automatically.',
    },
    {
      label: 'System events retention',
      value: `${data.system.system_events_retention_days} days`,
      hint: 'Pruned nightly at 03:00 (system_events.purge).',
    },
    {
      label: 'Outbox flush interval',
      value: `${(data.system.outbox_flush_interval_ms / 1000).toFixed(0)} s`,
      hint: 'How often queued messages are processed.',
    },
    {
      label: 'JWT TTL',
      value: `${(data.system.jwt_ttl_seconds / 3600).toFixed(1)} h`,
      hint: 'Session lifetime before re-login is required.',
    },
    {
      label: 'Upload max size',
      value: `${(data.system.upload_max_bytes / 1024 / 1024).toFixed(1)} MB`,
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-slate-500" />
        <h2 className="font-semibold text-slate-900">System configuration</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Values are read from environment variables / <code className="font-mono">.env</code>. Edit there and restart the server to change.
      </p>
      <div className="divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.label} className="py-3 flex items-baseline gap-4">
            <div className="w-56 flex-none">
              <div className="text-sm font-medium text-slate-800">{r.label}</div>
              {r.hint && <div className="text-xs text-slate-500">{r.hint}</div>}
            </div>
            <div className="text-sm text-slate-700 font-mono">{r.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RolesTab() {
  const { data } = useQuery<RolesPayload>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles'),
  });

  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;

  const allKeys = data.permissions.map((p) => p.key);
  const keyToDesc = new Map(data.permissions.map((p) => [p.key, p.description ?? '']));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Roles &amp; permissions</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Read-only view. Custom role / permission editing will land in a future phase.
        </p>
        <div className="space-y-4">
          {data.roles.map((r) => (
            <div key={r.id} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <div>
                  <div className="font-medium text-slate-800">{r.name}</div>
                  {r.description && <div className="text-xs text-slate-500">{r.description}</div>}
                </div>
                <Badge variant="default">{r.user_count} user{r.user_count === 1 ? '' : 's'}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allKeys.map((k) => {
                  const on = r.permissions.includes(k);
                  return (
                    <span
                      key={k}
                      title={keyToDesc.get(k)}
                      className={`text-xs px-2 py-0.5 rounded-md font-mono ${on ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-100 line-through'}`}
                    >
                      {k}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
