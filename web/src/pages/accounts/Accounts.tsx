import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, BookOpen, FileText, BarChart3, ListChecks,
  Calculator, RotateCcw, Calendar,
} from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Tabs,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatMoney, formatDate } from '../../lib/format';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
  parent_id: string | null;
  description: string | null;
  status: 'active' | 'inactive';
}

interface Period {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  closed_at: string | null;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  period_id: string | null;
  narration: string;
  reference: string | null;
  status: 'draft' | 'posted' | 'reversed';
  created_by_name: string | null;
  created_at: string;
  lines: JournalLine[];
}

interface JournalLine {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

interface PlReport { income: number; expense: number; net: number; breakdown: Array<{ type: string; amount: number }>; }
interface BsReport {
  asset_total: number; liability_total: number; equity_total: number;
  breakdown: Array<{ type: string; debit: number; credit: number }>;
}

const TYPE_BADGE: Record<Account['type'], 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  asset: 'success', liability: 'danger', income: 'info', expense: 'warning', equity: 'default',
};

export default function Accounts() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('accounts.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('accounts.delete'));
  const canClose = useAuthStore((s) => s.hasPerm('accounts.close'));
  const { show, node } = useToasts();

  const [tab, setTab] = useState<'journal' | 'accounts' | 'reports'>('journal');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [accountOpen, setAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({
    code: '', name: '', type: 'asset' as Account['type'],
    parent_id: '', description: '', status: 'active' as Account['status'],
  });

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState<{
    entry_date: string; period_id: string; narration: string; reference: string;
    lines: Array<{ account_id: string; debit: number; credit: number }>;
  }>({
    entry_date: new Date().toISOString().slice(0, 10),
    period_id: '',
    narration: '',
    reference: '',
    lines: [{ account_id: '', debit: 0, credit: 0 }, { account_id: '', debit: 0, credit: 0 }],
  });

  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState({ name: '', start_date: '', end_date: '' });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts-list'],
    queryFn: () => api.get('/accounts/accounts').then((r: { items: Account[] }) => r.items),
  });

  const { data: periods = [] } = useQuery<Period[]>({
    queryKey: ['periods-list'],
    queryFn: () => api.get('/accounts/periods').then((r: { items: Period[] }) => r.items),
  });

  const { data: journal, isLoading: jLoading } = useQuery<{ items: JournalEntry[] }>({
    queryKey: ['journal', dateFrom, dateTo],
    queryFn: () => api.get(`/accounts/journal?startDate=${dateFrom}&endDate=${dateTo}`),
  });

  const { data: trialBalance } = useQuery<{ items: TrialBalanceRow[]; totals: { debit: number; credit: number } }>({
    queryKey: ['trial-balance', dateFrom, dateTo],
    queryFn: () => api.get(`/accounts/reports/trial-balance?startDate=${dateFrom}&endDate=${dateTo}`),
  });

  const { data: pl } = useQuery<PlReport>({
    queryKey: ['pl', dateFrom, dateTo],
    queryFn: () => api.get(`/accounts/reports/pl?startDate=${dateFrom}&endDate=${dateTo}`),
  });

  const { data: bs } = useQuery<BsReport>({
    queryKey: ['bs'],
    queryFn: () => api.get('/accounts/reports/balance-sheet'),
  });

  const totalDebit = useMemo(
    () => entryForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0),
    [entryForm],
  );
  const totalCredit = useMemo(
    () => entryForm.lines.reduce((s, l) => s + Number(l.credit || 0), 0),
    [entryForm],
  );

  const openCreateAccount = () => {
    setEditingAccount(null);
    setAccountForm({ code: '', name: '', type: 'asset', parent_id: '', description: '', status: 'active' });
    setAccountOpen(true);
  };

  const openEditAccount = (a: Account) => {
    setEditingAccount(a);
    setAccountForm({
      code: a.code, name: a.name, type: a.type,
      parent_id: a.parent_id ?? '', description: a.description ?? '', status: a.status,
    });
    setAccountOpen(true);
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: accountForm.code,
        name: accountForm.name,
        type: accountForm.type,
        parent_id: accountForm.parent_id || null,
        description: accountForm.description || null,
        status: accountForm.status,
      };
      if (editingAccount) {
        await api.patch(`/accounts/accounts/${editingAccount.id}`, payload);
        show('Account updated', 'success');
      } else {
        await api.post('/accounts/accounts', payload);
        show('Account created', 'success');
      }
      setAccountOpen(false);
      qc.invalidateQueries({ queryKey: ['accounts-list'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const removeAccount = async (a: Account) => {
    if (!confirm(`Delete account "${a.code} - ${a.name}"?`)) return;
    try {
      const res = await api.delete<{ deactivated?: boolean }>(`/accounts/accounts/${a.id}`);
      show(res.deactivated ? 'Account has transactions — deactivated' : 'Account deleted', 'success');
      qc.invalidateQueries({ queryKey: ['accounts-list'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const openEntry = () => {
    setEntryForm({
      entry_date: new Date().toISOString().slice(0, 10),
      period_id: periods.find((p) => p.status === 'open')?.id ?? '',
      narration: '', reference: '',
      lines: [{ account_id: '', debit: 0, credit: 0 }, { account_id: '', debit: 0, credit: 0 }],
    });
    setEntryOpen(true);
  };

  const addLine = () => setEntryForm({
    ...entryForm,
    lines: [...entryForm.lines, { account_id: '', debit: 0, credit: 0 }],
  });

  const removeLine = (i: number) => setEntryForm({
    ...entryForm,
    lines: entryForm.lines.filter((_, idx) => idx !== i),
  });

  const updateLine = (i: number, key: 'account_id' | 'debit' | 'credit', value: string | number) => {
    const lines = [...entryForm.lines];
    lines[i] = { ...lines[i], [key]: value };
    setEntryForm({ ...entryForm, lines });
  };

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      show(`Debits (${totalDebit}) must equal credits (${totalCredit})`, 'error');
      return;
    }
    try {
      await api.post('/accounts/journal', {
        entry_date: entryForm.entry_date,
        period_id: entryForm.period_id || null,
        narration: entryForm.narration,
        reference: entryForm.reference || null,
        lines: entryForm.lines.filter((l) => l.account_id && (l.debit > 0 || l.credit > 0)),
      });
      show('Journal entry posted', 'success');
      setEntryOpen(false);
      qc.invalidateQueries({ queryKey: ['journal'] });
      qc.invalidateQueries({ queryKey: ['trial-balance'] });
      qc.invalidateQueries({ queryKey: ['pl'] });
      qc.invalidateQueries({ queryKey: ['bs'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const reverseEntry = async (e: JournalEntry) => {
    if (!confirm(`Reverse entry ${e.entry_number}?`)) return;
    try {
      await api.post(`/accounts/journal/${e.id}/reverse`, {});
      show('Entry reversed', 'success');
      qc.invalidateQueries({ queryKey: ['journal'] });
      qc.invalidateQueries({ queryKey: ['trial-balance'] });
      qc.invalidateQueries({ queryKey: ['pl'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const savePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/accounts/periods', periodForm);
      show('Period created', 'success');
      setPeriodOpen(false);
      setPeriodForm({ name: '', start_date: '', end_date: '' });
      qc.invalidateQueries({ queryKey: ['periods-list'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const closePeriod = async (p: Period) => {
    if (!confirm(`Close period "${p.name}"? Cannot post to a closed period.`)) return;
    try {
      await api.post(`/accounts/periods/${p.id}/close`, {});
      show('Period closed', 'success');
      qc.invalidateQueries({ queryKey: ['periods-list'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const reopenPeriod = async (p: Period) => {
    if (!confirm(`Reopen period "${p.name}"?`)) return;
    try {
      await api.post(`/accounts/periods/${p.id}/reopen`, {});
      show('Period reopened', 'success');
      qc.invalidateQueries({ queryKey: ['periods-list'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Accounts"
        description="Chart of accounts, journal entries, period close, financial reports"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPeriodOpen(true)}>
              <Calendar className="w-4 h-4" /> New Period
            </Button>
            {canWrite && (
              <>
                <Button variant="secondary" onClick={openCreateAccount}>
                  <Plus className="w-4 h-4" /> Account
                </Button>
                <Button onClick={openEntry}>
                  <Plus className="w-4 h-4" /> Journal Entry
                </Button>
              </>
            )}
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Date range:</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          <span className="text-slate-400">→</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-blue-600 hover:underline">
              Clear
            </button>
          )}
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: 'journal', label: 'Journal', icon: ListChecks },
          { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen },
          { id: 'reports', label: 'Reports', icon: BarChart3 },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'journal' && (
        <div className="space-y-4">
          {periods.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="font-medium">Periods:</span>
                {periods.map((p) => (
                  <div key={p.id} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1">
                    <span>{p.name}</span>
                    <Badge variant={p.status === 'open' ? 'success' : 'default'}>{p.status}</Badge>
                    {canClose && p.status === 'open' && (
                      <button onClick={() => closePeriod(p)} className="text-xs text-blue-600 hover:underline ml-1">close</button>
                    )}
                    {canClose && p.status === 'closed' && (
                      <button onClick={() => reopenPeriod(p)} className="text-xs text-blue-600 hover:underline ml-1">reopen</button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card>
            {jLoading ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : (journal?.items.length ?? 0) === 0 ? (
              <EmptyState title="No journal entries" description="Post your first journal entry to start tracking." />
            ) : (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Entry #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Narration</th>
                    <th className="px-4 py-3">Lines</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {journal!.items.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{e.entry_number}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{formatDate(e.entry_date)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-slate-900">{e.narration}</div>
                        {e.reference && <div className="text-xs text-slate-500">Ref: {e.reference}</div>}
                        <div className="text-xs text-slate-400 mt-1">
                          {e.lines.map((l) => (
                            <span key={l.id} className="mr-3">
                              {l.account_code} {l.debit > 0 ? `Dr ${formatMoney(l.debit)}` : `Cr ${formatMoney(l.credit)}`}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{e.lines.length}</td>
                      <td className="px-4 py-3">
                        <Badge variant={e.status === 'posted' ? 'success' : e.status === 'reversed' ? 'default' : 'warning'}>
                          {e.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canDelete && e.status === 'posted' && (
                          <button onClick={() => reverseEntry(e)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded" title="Reverse">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === 'accounts' && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono">{a.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{a.name}</td>
                  <td className="px-4 py-3"><Badge variant={TYPE_BADGE[a.type]}>{a.type}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={a.status === 'active' ? 'success' : 'default'}>{a.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button onClick={() => openEditAccount(a)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs">edit</button>
                    )}
                    {canDelete && (
                      <button onClick={() => removeAccount(a)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-5 h-5 text-blue-600" />
                <div className="font-semibold text-slate-900">Profit & Loss</div>
              </div>
              {pl && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Income</span>
                    <span className="font-mono text-emerald-700">{formatMoney(pl.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Expense</span>
                    <span className="font-mono text-red-700">{formatMoney(pl.expense)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-semibold">Net</span>
                    <span className={`font-mono font-semibold ${pl.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatMoney(pl.net)}
                    </span>
                  </div>
                </div>
              )}
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div className="font-semibold text-slate-900">Balance Sheet</div>
              </div>
              {bs && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Assets</span>
                    <span className="font-mono">{formatMoney(bs.asset_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Liabilities</span>
                    <span className="font-mono">{formatMoney(bs.liability_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Equity</span>
                    <span className="font-mono">{formatMoney(bs.equity_total)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-semibold">Liabilities + Equity</span>
                    <span className="font-mono font-semibold">{formatMoney(bs.liability_total + bs.equity_total)}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <div className="font-semibold text-slate-900">Trial Balance</div>
            </div>
            {trialBalance && (
              <Table>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.items.filter((t) => t.total_debit > 0 || t.total_credit > 0).map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-sm font-mono">{r.code}</td>
                      <td className="px-3 py-2 text-sm">{r.name}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{formatMoney(r.total_debit)}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{formatMoney(r.total_credit)}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{formatMoney(r.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <td colSpan={2} className="px-3 py-2 text-sm">Total</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{formatMoney(trialBalance.totals.debit)}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{formatMoney(trialBalance.totals.credit)}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title={editingAccount ? 'Edit Account' : 'New Account'} size="lg">
        <form onSubmit={saveAccount} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Code" required>
              <Input value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} required maxLength={20} />
            </FormField>
            <FormField label="Type" required>
              <Select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value as Account['type'] })}>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Name" required>
            <Input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required maxLength={120} />
          </FormField>
          <FormField label="Parent Account">
            <Select value={accountForm.parent_id} onChange={(e) => setAccountForm({ ...accountForm, parent_id: e.target.value })}>
              <option value="">(none)</option>
              {accounts.filter((a) => a.id !== editingAccount?.id).map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description">
            <Input value={accountForm.description} onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })} maxLength={500} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setAccountOpen(false)}>Cancel</Button>
            <Button type="submit">{editingAccount ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title="New Journal Entry" size="lg">
        <form onSubmit={saveEntry} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Date" required>
              <Input type="date" value={entryForm.entry_date} onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })} required />
            </FormField>
            <FormField label="Period">
              <Select value={entryForm.period_id} onChange={(e) => setEntryForm({ ...entryForm, period_id: e.target.value })}>
                <option value="">(none)</option>
                {periods.filter((p) => p.status === 'open').map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Reference">
              <Input value={entryForm.reference} onChange={(e) => setEntryForm({ ...entryForm, reference: e.target.value })} maxLength={80} />
            </FormField>
          </div>
          <FormField label="Narration" required>
            <Input value={entryForm.narration} onChange={(e) => setEntryForm({ ...entryForm, narration: e.target.value })} required maxLength={500} />
          </FormField>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-700">Lines</div>
              <button type="button" onClick={addLine} className="text-xs text-blue-600 hover:underline">+ Add line</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500 border-b border-slate-100">
                  <th className="px-2 py-1 text-left">Account</th>
                  <th className="px-2 py-1 text-right">Debit</th>
                  <th className="px-2 py-1 text-right">Credit</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {entryForm.lines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-2 py-1">
                      <Select value={l.account_id} onChange={(e) => updateLine(i, 'account_id', e.target.value)}>
                        <option value="">Select...</option>
                        {accounts.filter((a) => a.status === 'active').map((a) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.01" value={l.debit} onChange={(e) => updateLine(i, 'debit', Number(e.target.value))} className="text-right" />
                    </td>
                    <td className="px-2 py-1">
                      <Input type="number" step="0.01" value={l.credit} onChange={(e) => updateLine(i, 'credit', Number(e.target.value))} className="text-right" />
                    </td>
                    <td className="px-2 py-1 text-right">
                      {entryForm.lines.length > 2 && (
                        <button type="button" onClick={() => removeLine(i)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-2 py-1 text-sm">Total</td>
                  <td className={`px-2 py-1 text-sm text-right font-mono ${Math.abs(totalDebit - totalCredit) > 0.01 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {formatMoney(totalDebit)}
                  </td>
                  <td className="px-2 py-1 text-sm text-right font-mono">{formatMoney(totalCredit)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setEntryOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={Math.abs(totalDebit - totalCredit) > 0.01}>Post Entry</Button>
          </div>
        </form>
      </Modal>

      <Modal open={periodOpen} onClose={() => setPeriodOpen(false)} title="New Accounting Period">
        <form onSubmit={savePeriod} className="space-y-3">
          <FormField label="Name" required>
            <Input value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} required maxLength={80} placeholder="FY 2026-2027" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" required>
              <Input type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })} required />
            </FormField>
            <FormField label="End Date" required>
              <Input type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })} required />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setPeriodOpen(false)}>Cancel</Button>
            <Button type="submit">Create Period</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}