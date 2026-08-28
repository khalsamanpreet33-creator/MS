import { useState } from 'react';
import { Bus, UserCircle, Route as RouteIcon } from 'lucide-react';
import Vehicles from './Vehicles';
import Drivers from './Drivers';
import Routes from './Routes';

type Tab = 'vehicles' | 'drivers' | 'routes';

export default function Transport() {
  const [tab, setTab] = useState<Tab>('routes');
  return (
    <div>
      <div className="border-b border-slate-200 mb-4">
        <nav className="flex gap-1">
          <TabBtn active={tab === 'routes'} onClick={() => setTab('routes')} icon={RouteIcon} label="Routes" />
          <TabBtn active={tab === 'vehicles'} onClick={() => setTab('vehicles')} icon={Bus} label="Vehicles" />
          <TabBtn active={tab === 'drivers'} onClick={() => setTab('drivers')} icon={UserCircle} label="Drivers" />
        </nav>
      </div>
      {tab === 'vehicles' && <Vehicles />}
      {tab === 'drivers' && <Drivers />}
      {tab === 'routes' && <Routes />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
