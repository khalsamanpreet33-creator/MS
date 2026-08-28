import { Menu, Bell } from 'lucide-react';
import { useAuthStore } from '../../store/auth';

interface Props {
  onMenu: () => void;
  title?: string;
}

export default function Topbar({ onMenu, title }: Props) {
  const user = useAuthStore((s) => s.user);
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 sticky top-0 z-20">
      <button
        onClick={onMenu}
        className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1 ml-2 lg:ml-0">
        <div className="text-xs text-slate-500">{today}</div>
        <div className="text-base font-semibold text-slate-900 truncate">
          {title ?? 'School ERP'}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg text-slate-600 hover:bg-slate-50 relative">
          <Bell className="w-5 h-5" />
        </button>
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-slate-900">{user?.full_name}</div>
          <div className="text-xs text-slate-500">{user?.roles.join(', ')}</div>
        </div>
      </div>
    </header>
  );
}