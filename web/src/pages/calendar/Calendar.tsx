import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { api } from '../../lib/api';
import {
  PageHeader, Card, Input, Select, Badge, EmptyState,
} from '../../components/ui';

interface Item {
  id: string;
  source: 'event' | 'holiday' | 'exam' | 'notice' | 'timetable';
  title: string;
  description: string | null;
  start: string;
  end: string | null;
  all_day: number;
  category: string | null;
  audience: string | null;
  location: string | null;
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function monthName(d: Date): string { return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }); }

const SOURCE_VARIANT: Record<Item['source'], 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  event: 'info',
  holiday: 'danger',
  exam: 'warning',
  notice: 'default',
  timetable: 'success',
};

export default function Calendar() {
  const [anchor, setAnchor] = useState(new Date());
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');

  const from = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const offset = first.getDay();
    return new Date(first.getTime() - offset * 86_400_000);
  }, [anchor]);
  const to = useMemo(() => {
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const offset = 6 - last.getDay();
    return new Date(last.getTime() + offset * 86_400_000);
  }, [anchor]);

  const { data = { items: [] as Item[] }, isLoading } = useQuery<{ items: Item[] }>({
    queryKey: ['calendar', ymd(from), ymd(to), sourceFilter, audienceFilter],
    queryFn: () => {
      const params = new URLSearchParams({ from: ymd(from), to: ymd(to) });
      if (sourceFilter !== 'all') params.set('category', sourceFilter);
      if (audienceFilter !== 'all') params.set('audience', audienceFilter);
      return api.get(`/calendar?${params.toString()}`);
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of data.items) {
      const day = item.start.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(item);
    }
    return map;
  }, [data.items]);

  const today = ymd(new Date());
  const days: Date[] = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86_400_000)) days.push(new Date(d));

  return (
    <div>
      <PageHeader
        title="Central Calendar"
        description={`${data.items.length} item(s) in view`}
        actions={
          <div className="flex items-center gap-1">
            <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-sm px-2 min-w-[160px] text-center">{monthName(anchor)}</span>
            <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setAnchor(new Date())} className="ml-2 px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50">Today</button>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">All sources</option>
          <option value="event">Events</option>
          <option value="holiday">Holidays</option>
          <option value="exam">Exams</option>
          <option value="notice">Notices</option>
        </Select>
        <Select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)}>
          <option value="all">All audiences</option>
          <option value="students">Students</option>
          <option value="parents">Parents</option>
          <option value="staff">Staff</option>
          <option value="teachers">Teachers</option>
        </Select>
      </div>

      <Card>
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> :
          <div>
            <div className="grid grid-cols-7 border-b border-slate-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="px-2 py-2 text-xs font-medium uppercase text-slate-500 border-r border-slate-100 last:border-r-0">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = ymd(d);
                const dayItems = byDay.get(key) ?? [];
                const isOtherMonth = d.getMonth() !== anchor.getMonth();
                const isToday = key === today;
                return (
                  <div
                    key={key}
                    className={`min-h-[100px] border-r border-b border-slate-100 p-1 ${isOtherMonth ? 'bg-slate-50/60' : ''} ${isToday ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-700' : isOtherMonth ? 'text-slate-400' : 'text-slate-700'}`}>
                      {d.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((it) => (
                        <div key={it.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${it.source === 'holiday' ? 'bg-red-50 text-red-700' : it.source === 'exam' ? 'bg-amber-50 text-amber-700' : it.source === 'notice' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>
                          {it.title}
                        </div>
                      ))}
                      {dayItems.length > 3 && <div className="text-[10px] text-slate-500">+{dayItems.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
      </Card>

      <div className="mt-6">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          Upcoming in view
        </h3>
        {data.items.length === 0 ? <EmptyState title="Nothing scheduled" description="No calendar items in this view." /> :
          <Card>
            <ul className="divide-y divide-slate-100">
              {data.items.slice(0, 20).map((it) => (
                <li key={it.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Badge variant={SOURCE_VARIANT[it.source]}>{it.source}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{it.title}</div>
                    {it.description && <div className="text-xs text-slate-600 line-clamp-1 mt-0.5">{it.description}</div>}
                    <div className="text-xs text-slate-400 mt-1">
                      {it.start}
                      {it.end && it.end !== it.start && ` → ${it.end}`}
                      {it.location && ` · ${it.location}`}
                      {it.audience && it.audience !== 'all' && ` · ${it.audience}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        }
      </div>
    </div>
  );
}
