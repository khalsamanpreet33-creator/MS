import { useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import OfflineBanner from './components/layout/OfflineBanner';

// Page-level code-splitting: keeps recharts off the login bundle and
// makes every non-Dashboard page tree-shake independently.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StudentsList = lazy(() => import('./pages/students/StudentsList'));
const StudentForm = lazy(() => import('./pages/students/StudentForm'));
const StudentDetail = lazy(() => import('./pages/students/StudentDetail'));
const Classes = lazy(() => import('./pages/Classes'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Fees = lazy(() => import('./pages/Fees'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const BackupManagement = lazy(() => import('./pages/BackupManagement'));
const Settings = lazy(() => import('./pages/Settings'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Academics = lazy(() => import('./pages/Academics'));
const QuestionPapers = lazy(() => import('./pages/QuestionPapers'));
const StaffList = lazy(() => import('./pages/staff/StaffList'));
const StaffDetail = lazy(() => import('./pages/staff/StaffDetail'));
const TeachersList = lazy(() => import('./pages/teachers/TeachersList'));
const TeacherDetail = lazy(() => import('./pages/teachers/TeacherDetail'));
const HR = lazy(() => import('./pages/hr/HR'));
const Payroll = lazy(() => import('./pages/payroll/Payroll'));
const Exams = lazy(() => import('./pages/exams/Exams'));
const Admissions = lazy(() => import('./pages/admissions/Admissions'));
const Parents = lazy(() => import('./pages/parents/Parents'));
const Homework = lazy(() => import('./pages/homework/Homework'));
const Timetable = lazy(() => import('./pages/timetable/Timetable'));
const Accounts = lazy(() => import('./pages/accounts/Accounts'));
const Tasks = lazy(() => import('./pages/tasks/Tasks'));
const Documents = lazy(() => import('./pages/documents/Documents'));
const Events = lazy(() => import('./pages/events/Events'));
const Complaints = lazy(() => import('./pages/complaints/Complaints'));
const IdCards = lazy(() => import('./pages/idcards/IdCards'));
const Certificates = lazy(() => import('./pages/certificates/Certificates'));
const Notices = lazy(() => import('./pages/notices/Notices'));
const Emergency = lazy(() => import('./pages/emergency/Emergency'));
const Notifications = lazy(() => import('./pages/notifications/Notifications'));
const BulkComm = lazy(() => import('./pages/bulkComm/BulkComm'));
const Transport = lazy(() => import('./pages/transport/Transport'));
const Library = lazy(() => import('./pages/library/Library'));
const Inventory = lazy(() => import('./pages/inventory/Inventory'));
const Assets = lazy(() => import('./pages/assets/Assets'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const Calendar = lazy(() => import('./pages/calendar/Calendar'));
const Results = lazy(() => import('./pages/results/Results'));
const Approvals = lazy(() => import('./pages/approvals/Approvals'));
const ModuleStub = lazy(() => import('./pages/stubs/ModuleStub'));

const STUB_ROUTES: { path: string; name: string; phase?: string; description?: string; features?: string[] }[] = [
  { path: '/admissions', name: 'Admissions', phase: 'Phase 2', features: ['Inquiry capture', 'Application workflow', 'Document checklist', 'Entrance test scoring'] },
  { path: '/parents', name: 'Parents Portal', phase: 'Phase 2', features: ['Parent profile', 'Linked students', 'Communication log'] },
  { path: '/exams', name: 'Exams', phase: 'Phase 2', features: ['Exam schedule', 'Marks entry', 'Grade scales'] },
  { path: '/results', name: 'Results & Report Cards', phase: 'Phase 2', features: ['Mark sheets', 'Report card PDFs', 'Publish'] }, // overridden by Results above
  { path: '/question-papers', name: 'Question Papers', phase: 'Phase 2', features: ['Question bank', 'Paper generator'] },
  { path: '/accounts', name: 'Accounts', phase: 'Phase 3', features: ['Chart of accounts', 'Journal entries', 'Trial balance', 'P&L', 'Balance sheet'] },
  { path: '/payroll', name: 'Payroll', phase: 'Phase 3', features: ['Salary structures', 'Payslips', 'TDS'] },
  { path: '/hr', name: 'HR & Leave', phase: 'Phase 3', features: ['Leave applications', 'Approvals', 'Shifts'] },
  { path: '/library', name: 'Library', phase: 'Phase 4', features: ['Books', 'Issues/returns', 'Fines', 'Catalog'] }, // overridden by Library page above
  { path: '/inventory', name: 'Inventory', phase: 'Phase 4', features: ['Items', 'Stock', 'Vendors'] }, // overridden by Inventory above
  { path: '/assets', name: 'Assets', phase: 'Phase 4', features: ['Asset register', 'Assignment', 'Depreciation'] }, // overridden by Assets above
  { path: '/documents', name: 'Documents', phase: 'Phase 4', features: ['Per-student/staff docs', 'Expiry alerts', 'File metadata'] },
  { path: '/events', name: 'Events', phase: 'Phase 4', features: ['Event planning', 'Calendar', 'Registration'] },
  { path: '/complaints', name: 'Complaints', phase: 'Phase 4', features: ['Tickets', 'Assignment', 'Resolution'] },
  { path: '/idcards', name: 'ID Cards', phase: 'Phase 4', features: ['Templates', 'Bulk print'] },
  { path: '/certificates', name: 'Certificates', phase: 'Phase 4', features: ['Templates', 'Generation', 'Bulk print'] },
  { path: '/question-papers', name: 'Question Papers', phase: 'Phase 4', features: ['Question bank', 'Paper generator'] },
  { path: '/reports', name: 'Reports', phase: 'Phase 4', features: ['Attendance reports', 'Fee reports', 'Custom report builder'] }, // overridden by Reports above
  { path: '/calendar', name: 'Central Calendar', phase: 'Phase 5', features: ['School calendar', 'Department filtering'] }, // overridden by Calendar above
  { path: '/tasks', name: 'Tasks & Follow-ups', phase: 'Phase 4', features: ['Personal/team tasks', 'Due dates', 'Assignment', 'Status'] },
  { path: '/approvals', name: 'Approval Centre', phase: 'Phase 5', features: ['Leave approvals', 'Fee concession', 'Refunds'] }, // overridden by Approvals above
  { path: '/audit', name: 'Audit Log', phase: 'Phase 5', features: ['User actions', 'Filters', 'CSV export'] },
];

export default function App() {
  const token = useAuthStore((s) => s.token);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!token) return <Suspense fallback={<RouteFallback />}><Login /></Suspense>;

  const title = deriveTitle(location.pathname);

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-72 flex-1 min-w-0">
        <Topbar onMenu={() => setSidebarOpen(true)} title={title} />
        <OfflineBanner />
        <main className="p-4 lg:p-6">
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/students" element={<StudentsList />} />
            <Route path="/students/new" element={<StudentForm />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/students/:id/edit" element={<StudentForm />} />

            <Route path="/classes" element={<Classes />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/fees" element={<Fees />} />

            <Route path="/system-health" element={<SystemHealth />} />
            <Route path="/backup" element={<BackupManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/academics" element={<Academics />} />
            <Route path="/question-papers" element={<QuestionPapers />} />
            <Route path="/staff" element={<StaffList />} />
            <Route path="/staff/:id" element={<StaffDetail />} />
            <Route path="/teachers" element={<TeachersList />} />
            <Route path="/teachers/:id" element={<TeacherDetail />} />
            <Route path="/hr" element={<HR />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/parents" element={<Parents />} />
            <Route path="/homework" element={<Homework />} />
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/events" element={<Events />} />
            <Route path="/complaints" element={<Complaints />} />
            <Route path="/idcards" element={<IdCards />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/notices" element={<Notices />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/bulk-comm" element={<BulkComm />} />
            <Route path="/transport" element={<Transport />} />
            <Route path="/vehicles" element={<Transport />} />
            <Route path="/drivers" element={<Transport />} />
            <Route path="/library" element={<Library />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/results" element={<Results />} />
            <Route path="/approvals" element={<Approvals />} />

            {STUB_ROUTES.map((r) => (
              <Route
                key={r.path}
                path={r.path}
                element={
                  <ModuleStub
                    name={r.name}
                    phase={r.phase}
                    description={r.description}
                    features={r.features}
                  />
                }
              />
            ))}

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
  );
}

function deriveTitle(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/students')) return 'Students';
  if (pathname.startsWith('/classes')) return 'Classes & Sections';
  if (pathname.startsWith('/attendance')) return 'Attendance';
  if (pathname.startsWith('/fees')) return 'Fees';
  if (pathname.startsWith('/transport')) return 'Transport';
  if (pathname.startsWith('/library')) return 'Library';
  if (pathname.startsWith('/payroll')) return 'Payroll';
  if (pathname.startsWith('/accounts')) return 'Accounts';
  if (pathname.startsWith('/hr')) return 'HR & Leave';
  if (pathname.startsWith('/exams')) return 'Exams';
  if (pathname.startsWith('/results')) return 'Results';
  if (pathname.startsWith('/timetable')) return 'Timetable';
  if (pathname.startsWith('/homework')) return 'Homework';
  if (pathname.startsWith('/reports')) return 'Reports';
  if (pathname.startsWith('/staff')) return 'Staff Directory';
  if (pathname.startsWith('/teachers')) return 'Teachers';
  if (pathname.startsWith('/system-health')) return 'System Health';
  if (pathname.startsWith('/backup')) return 'Backup & Restore';
  return 'School ERP';
}