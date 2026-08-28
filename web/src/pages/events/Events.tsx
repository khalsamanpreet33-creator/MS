import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar, MapPin, Users, Edit2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import {
  PageHeader, Card, Button, Input, Select, Table, Badge,
  useToasts, EmptyState, Modal, FormField, Textarea,
} from '../../components/ui';
import { useAuthStore } from '../../store/auth';
import { formatDate, classNames } from '../../lib/format';

interface Event {
  id: string;
  title: string;
  description: string | null;
  category: 'academic' | 'sports' | 'cultural' | 'holiday' | 'meeting' | 'general';
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  audience: 'all' | 'students' | 'staff' | 'parents';
  is_holiday: number;
  created_by_name: string | null;
  rsvp_count: number;
}

const CAT_COLOR: Record<Event['category'], string> = {
  academic: 'bg-blue-100 text-blue-700',
  sports: 'bg-emerald-100 text-emerald-700',
  cultural: 'bg-purple-100 text-purple-700',
  holiday: 'bg-red-100 text-red-700',
  meeting: 'bg-amber-100 text-amber-700',
  general: 'bg-slate-100 text-slate-700',
};

export default function Events() {
  const qc = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPerm('events.write'));
  const canDelete = useAuthStore((s) => s.hasPerm('events.delete'));
  const { show, node } = useToasts();

  const [filterCat, setFilterCat] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', category: 'general' as Event['category'],
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '', start_time: '', end_time: '',
    location: '', audience: 'all' as Event['audience'], is_holiday: false,
  });

  const { data, isLoading } = useQuery<{ items: Event[] }>({
    queryKey: ['events', filterCat, filterStart, filterEnd],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterCat) params.set('category', filterCat);
      if (filterStart) params.set('start', filterStart);
      if (filterEnd) params.set('end', filterEnd);
      return api.get(`/events?${params}`);
    },
  });

  const open = (e?: Event) => {
    if (e) {
      setEditingId(e.id);
      setForm({
        title: e.title, description: e.description ?? '', category: e.category,
        start_date: e.start_date, end_date: e.end_date ?? '',
        start_time: e.start_time ?? '', end_time: e.end_time ?? '',
        location: e.location ?? '', audience: e.audience,
        is_holiday: !!e.is_holiday,
      });
    } else {
      setEditingId(null);
      setForm({
        title: '', description: '', category: 'general',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: '', start_time: '', end_time: '',
        location: '', audience: 'all', is_holiday: false,
      });
    }
    setCreateOpen(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        category: form.category,
        start_date: form.start_date,
        end_date: form.end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        audience: form.audience,
        is_holiday: form.is_holiday,
      };
      if (editingId) {
        await api.patch(`/events/${editingId}`, payload);
        show('Event updated', 'success');
      } else {
        await api.post('/events', payload);
        show('Event created', 'success');
      }
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['events'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const remove = async (e: Event) => {
    if (!confirm(`Delete "${e.title}"?`)) return;
    try {
      await api.delete(`/events/${e.id}`);
      show('Event deleted', 'success');
      qc.invalidateQueries({ queryKey: ['events'] });
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  const rsvp = async (id: string, response: 'yes' | 'no' | 'maybe') => {
    try {
      await api.post(`/events/${id}/rsvp`, { response });
      show(`RSVP: ${response}`, 'success');
    } catch (e) { show((e as ApiError).message, 'error'); }
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Events"
        description={`${data?.items.length ?? 0} event(s)`}
        actions={canWrite && <Button onClick={() => open()}><Plus className="w-4 h-4" /> New Event</Button>}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="w-auto">
            <option value="">All categories</option>
            <option value="academic">Academic</option>
            <option value="sports">Sports</option>
            <option value="cultural">Cultural</option>
            <option value="holiday">Holiday</option>
            <option value="meeting">Meeting</option>
            <option value="general">General</option>
          </Select>
          <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="w-auto" placeholder="From" />
          <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="w-auto" placeholder="To" />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No events"
            description="Schedule an event to populate the school calendar."
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">RSVP</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-slate-900">{e.title}</div>
                    {e.description && <div className="text-xs text-slate-500 line-clamp-1">{e.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={classNames('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', CAT_COLOR[e.category])}>
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {formatDate(e.start_date)}
                      {e.end_date && e.end_date !== e.start_date && ` – ${formatDate(e.end_date)}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {e.start_time ? `${e.start_time}${e.end_time ? `–${e.end_time}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {e.location ? (
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{e.location}</div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant="info">{e.audience}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span className="text-sm">{e.rsvp_count}</span>
                      <div className="flex gap-1 ml-2">
                        <button onClick={() => rsvp(e.id, 'yes')} className="text-xs text-emerald-600 hover:underline">Yes</button>
                        <button onClick={() => rsvp(e.id, 'maybe')} className="text-xs text-amber-600 hover:underline">Maybe</button>
                        <button onClick={() => rsvp(e.id, 'no')} className="text-xs text-slate-500 hover:underline">No</button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button onClick={() => open(e)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => remove(e)} className="text-red-600 hover:bg-red-50 p-1.5 rounded ml-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={editingId ? 'Edit Event' : 'New Event'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Event['category'] })}>
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="sports">Sports</option>
                <option value="cultural">Cultural</option>
                <option value="holiday">Holiday</option>
                <option value="meeting">Meeting</option>
              </Select>
            </FormField>
            <FormField label="Audience">
              <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Event['audience'] })}>
                <option value="all">All</option>
                <option value="students">Students</option>
                <option value="staff">Staff</option>
                <option value="parents">Parents</option>
              </Select>
            </FormField>
            <FormField label="Location">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={160} />
            </FormField>
            <FormField label="Start Date" required>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </FormField>
            <FormField label="End Date">
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </FormField>
            <div />
            <FormField label="Start Time">
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </FormField>
            <FormField label="End Time">
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </FormField>
            <FormField label="Mark as Holiday">
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={form.is_holiday} onChange={(e) => setForm({ ...form, is_holiday: e.target.checked })} />
                <span className="text-sm">This is a school holiday</span>
              </label>
            </FormField>
          </div>
          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}