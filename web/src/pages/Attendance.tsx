import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, CheckCircle2, X, Clock3 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import {
  PageHeader, Card, Button, Select, Input, useToasts, Table, Badge,
} from '../components/ui';
import { useAuthStore } from '../store/auth';
import { formatDate } from '../lib/format';

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; class_id: string; }
interface Student { id: string; first_name: string; last_name: string; admission_no: string; current_section_id: string | null; }

interface SessionResp {
  id: string;
  date: string;
  class_id: string;
  section_id: string;
  taken_by_name?: string;
  total_marked?: number;
  present_count?: number;
  absent_count?: number;
  leave_count?: number;
}

interface SessionDetail {
  session: {
    id: string; date: string; class_id: string; section_id: string;
    class_name: string; section_name: string;
  };
  records: { id: string; student_id: string; status: 'present' | 'absent' | 'leave'; remarks: string | null; first_name: string; last_name: string; admission_no: string }[];
}

export default function Attendance() {
  const canWrite = useAuthStore((s) => s.hasPerm('attendance.write'));
  const qc = useQueryClient();
  const { show, node } = useToasts();
  const today = new Date().toISOString().slice(0, 10);

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(today);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, 'present' | 'absent' | 'leave'>>({});

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes-list'],
    queryFn: () => api.get('/classes').then((r: { items: ClassItem[] }) => r.items),
  });

  const { data: sections = [] } = useQuery<SectionItem[]>({
    queryKey: ['sections-all'],
    queryFn: () => api.get('/classes/all-sections').then(() => [] as SectionItem[]).catch(() => []),
  });

  const { data: existingSession } = useQuery<{ items: SessionResp[] }>({
    queryKey: ['attendance-session', classId, sectionId, date],
    queryFn: () => api.get(`/attendance/sessions?classId=${classId}&sectionId=${sectionId}&date=${date}`),
    enabled: !!(classId && sectionId),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students-in-section', classId, sectionId],
    queryFn: async () => {
      const r = await api.get<{ items: Student[] }>(`/students?classId=${classId}&sectionId=${sectionId}&pageSize=200`);
      return r.items;
    },
    enabled: !!(classId && sectionId),
  });

  const { data: sessionDetail } = useQuery<SessionDetail>({
    queryKey: ['session-detail', sessionId],
    queryFn: () => api.get(`/attendance/sessions/${sessionId}`),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (existingSession?.items?.length && !sessionId) {
      setSessionId(existingSession.items[0].id);
    }
  }, [existingSession, sessionId]);

  useEffect(() => {
    if (sessionDetail?.records) {
      const m: Record<string, 'present' | 'absent' | 'leave'> = {};
      for (const r of sessionDetail.records) m[r.student_id] = r.status;
      setRecords(m);
    } else if (!sessionId && students.length) {
      // Default all to present when opening a new session
      const m: Record<string, 'present' | 'absent' | 'leave'> = {};
      for (const s of students) m[s.id] = 'present';
      setRecords(m);
    }
  }, [sessionDetail, sessionId, students]);

  const filteredSections = sections.filter((s) => s.class_id === classId);

  const openSession = async () => {
    try {
      const res = await api.post<{ id: string }>('/attendance/sessions', {
        class_id: classId, section_id: sectionId, date,
      });
      setSessionId(res.id);
      qc.invalidateQueries({ queryKey: ['attendance-session'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const save = async () => {
    if (!sessionId) {
      await openSession();
      return;
    }
    const payload = students.map((s) => ({ student_id: s.id, status: records[s.id] ?? 'present' }));
    try {
      await api.post(`/attendance/sessions/${sessionId}/records`, { records: payload });
      show('Attendance saved', 'success');
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (e) {
      show((e as ApiError).message, 'error');
    }
  };

  const counts = {
    present: Object.values(records).filter((v) => v === 'present').length,
    absent: Object.values(records).filter((v) => v === 'absent').length,
    leave: Object.values(records).filter((v) => v === 'leave').length,
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Attendance"
        description="Mark and review daily attendance"
      />

      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-4 gap-3">
          <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); setSessionId(null); }}>
            <option value="">Class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setSessionId(null); }} disabled={!classId}>
            <option value="">Section</option>
            {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSessionId(null); }} />
          <div className="flex items-center gap-2 text-sm">
            {classId && sectionId && !sessionId && canWrite && (
              <Button size="sm" onClick={openSession}>
                Open session
              </Button>
            )}
            {sessionId && <Badge variant="info">Session open</Badge>}
          </div>
        </div>
      </Card>

      {classId && sectionId && (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <Card className="p-4 flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-600" /><div><div className="text-xs text-slate-500">Present</div><div className="text-xl font-semibold">{counts.present}</div></div></Card>
            <Card className="p-4 flex items-center gap-3"><X className="w-5 h-5 text-red-600" /><div><div className="text-xs text-slate-500">Absent</div><div className="text-xl font-semibold">{counts.absent}</div></div></Card>
            <Card className="p-4 flex items-center gap-3"><Clock3 className="w-5 h-5 text-amber-600" /><div><div className="text-xs text-slate-500">On leave</div><div className="text-xl font-semibold">{counts.leave}</div></div></Card>
          </div>

          <Card>
            <Table>
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Adm No</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">{s.admission_no}</td>
                    <td className="px-4 py-3">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex gap-1">
                        {(['present', 'absent', 'leave'] as const).map((k) => (
                          <button
                            key={k}
                            onClick={() => setRecords({ ...records, [s.id]: k })}
                            className={`px-3 py-1 rounded text-xs font-medium capitalize ${
                              records[s.id] === k
                                ? k === 'present' ? 'bg-emerald-600 text-white' :
                                  k === 'absent' ? 'bg-red-600 text-white' :
                                  'bg-amber-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-8 text-slate-400">No students in this section.</td></tr>
                )}
              </tbody>
            </Table>
            {canWrite && students.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex justify-end">
                <Button onClick={save}>
                  <Save className="w-4 h-4" /> Save attendance
                </Button>
              </div>
            )}
          </Card>
        </>
      )}

      {!classId && (
        <Card className="p-8 text-center text-slate-400">Select a class and section to begin.</Card>
      )}
    </div>
  );
}