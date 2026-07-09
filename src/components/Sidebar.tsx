import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  Package, 
  FileSpreadsheet, 
  Mail, 
  Database, 
  LogOut, 
  UserCircle,
  X
} from "lucide-react";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  userEmail: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ currentView, onViewChange, onLogout, userEmail, isOpen, onClose }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "settings", label: "Company Settings", icon: Settings },
    { id: "clients", label: "Clients Database", icon: Users },
    { id: "products", label: "Products & Services", icon: Package },
    { id: "invoices", label: "Invoices & Billing", icon: FileSpreadsheet },
    { id: "messages", label: "Messages", icon: Mail, badge: 5 },
    { id: "backup", label: "Backup & Restore", icon: Database },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-68 bg-gradient-to-b from-[#0c4cb3] to-[#063280] text-white flex flex-col h-screen flex-shrink-0 shadow-xl select-none
        transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold italic text-[#0c4cb3] text-xl border-2 border-white shadow-md">
              MS
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight">MS Billing System</h1>
              <p className="text-[10px] opacity-75">Smart Billing, Better Business</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button onClick={onClose} className="lg:hidden text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Menu Options */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white text-[#0c4cb3] shadow-md font-semibold scale-[1.02]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? "text-[#0c4cb3]" : "text-white/80"} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer / Dev Info */}
        <div className="p-4 border-t border-white/10 bg-black/10 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <UserCircle size={24} className="text-white/70" />
            <div className="min-w-0">
              <p className="text-[10px] text-white/50 leading-none">Developer</p>
              <h4 className="text-xs font-semibold text-white truncate">Manpreet Singh</h4>
              <p className="text-[9px] text-white/60 truncate leading-none mt-1">manpreet.pilibhit1@gmail.com</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 bg-red-500/20 hover:bg-red-500 hover:text-white text-red-300 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer border border-red-500/30 hover:border-transparent"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
