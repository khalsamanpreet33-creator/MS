import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Building2, CalendarCheck,
  Wallet, GraduationCap, ClipboardList, Bus, Library, Boxes,
  Bell, Settings, FileText, ShieldCheck, Calendar, Megaphone,
  AlertTriangle, Send, Database, HeartPulse, BookOpenCheck,
  Activity, ListChecks,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { classNames } from '../../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  soon?: boolean;
}

const NAV: NavItem[] = [
  // Student Management
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Student Management' },
  { to: '/students', label: 'Students', icon: Users, group: 'Student Management' },
  { to: '/admissions', label: 'Admissions', icon: BookOpenCheck, group: 'Student Management' },
  { to: '/parents', label: 'Parents', icon: Users, group: 'Student Management' },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, group: 'Student Management' },

  // Academics
  { to: '/classes', label: 'Classes & Sections', icon: Building2, group: 'Academic Management' },
  { to: '/timetable', label: 'Timetable', icon: Calendar, group: 'Academic Management' },
  { to: '/homework', label: 'Homework', icon: ClipboardList, group: 'Academic Management' },
  { to: '/exams', label: 'Exams', icon: GraduationCap, group: 'Academic Management' },
  { to: '/results', label: 'Results', icon: FileText, group: 'Academic Management' },
  { to: '/academics', label: 'Subjects & Syllabus', icon: BookOpen, group: 'Academic Management', soon: true },
  { to: '/question-papers', label: 'Question Papers', icon: FileText, group: 'Academic Management', soon: true },

  // Finance
  { to: '/fees', label: 'Fees', icon: Wallet, group: 'Finance' },
  { to: '/accounts', label: 'Accounts', icon: Database, group: 'Finance' },
  { to: '/payroll', label: 'Payroll', icon: Wallet, group: 'Finance' },

  // HR
  { to: '/teachers', label: 'Teachers', icon: GraduationCap, group: 'HR' },
  { to: '/staff', label: 'Staff', icon: Users, group: 'HR' },
  { to: '/hr', label: 'HR & Leave', icon: ClipboardList, group: 'HR' },

  // Operations
  { to: '/transport', label: 'Transport', icon: Bus, group: 'Operations' },
  { to: '/library', label: 'Library', icon: Library, group: 'Operations' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, group: 'Operations' },
  { to: '/assets', label: 'Assets', icon: Boxes, group: 'Operations' },
  { to: '/documents', label: 'Documents', icon: FileText, group: 'Operations' },
  { to: '/events', label: 'Events', icon: Calendar, group: 'Operations' },
  { to: '/complaints', label: 'Complaints', icon: AlertTriangle, group: 'Operations' },
  { to: '/idcards', label: 'ID Cards', icon: FileText, group: 'Operations' },
  { to: '/certificates', label: 'Certificates', icon: FileText, group: 'Operations' },
  { to: '/reports', label: 'Reports', icon: Activity, group: 'Operations' },

  // Communication
  { to: '/notices', label: 'Notice Board', icon: Megaphone, group: 'Communication' },
  { to: '/bulk-comm', label: 'Bulk Communication', icon: Send, group: 'Communication' },
  { to: '/emergency', label: 'Emergency Alerts', icon: AlertTriangle, group: 'Communication' },
  { to: '/notifications', label: 'Notifications', icon: Bell, group: 'Communication' },
  { to: '/calendar', label: 'Calendar', icon: Calendar, group: 'Communication' },

  // Admin
  { to: '/system-health', label: 'System Health', icon: HeartPulse, group: 'Admin', soon: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, group: 'Admin' },
  { to: '/approvals', label: 'Approval Centre', icon: ShieldCheck, group: 'Admin' },
  { to: '/backup', label: 'Backup & Restore', icon: Database, group: 'Admin', soon: true },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'Admin', soon: true },
];

const GROUP_ORDER = [
  'Student Management',
  'Academic Management',
  'Finance',
  'HR',
  'Operations',
  'Communication',
  'Admin',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const groups = GROUP_ORDER.map((g) => ({
    name: g,
    items: NAV.filter((n) => n.group === g),
  })).filter((g) => g.items.length);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={classNames(
          'fixed top-0 left-0 z-40 h-full w-72 bg-white border-r border-slate-200 transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="h-16 px-5 flex items-center gap-2 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center text-white font-bold">
            S
          </div>
          <div>
            <div className="font-semibold text-slate-900">School ERP</div>
            <div className="text-xs text-slate-500">LAN edition</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="px-3 mb-1 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                {g.name}
              </div>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        classNames(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        )
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.soon && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                          Soon
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold">
              {user?.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {user?.full_name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {user?.roles.join(', ')}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
              }}
              className="text-xs text-slate-500 hover:text-red-600"
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}