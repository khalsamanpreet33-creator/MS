import { Calendar, Search, Bell, HelpCircle, MessageSquare, Menu } from "lucide-react";
import { useEffect, useState } from "react";

interface TopbarProps {
  userEmail: string;
  onMenuClick?: () => void;
}

export default function Topbar({ userEmail, onMenuClick }: TopbarProps) {
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(new Date().toLocaleDateString('en-US', options));
  }, []);

  return (
    <header className="h-18 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between flex-shrink-0 shadow-sm select-none">
      {/* Left side info */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-[#0c4cb3] transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 shadow-sm">
          <Calendar size={14} className="text-[#0c4cb3]" />
          <span>{currentDate}</span>
        </div>
      </div>

      {/* Center search bar */}
      <div className="relative w-80 max-w-md hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search clients, products, or invoices..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0c4cb3] focus:ring-2 focus:ring-[#0c4cb3]/10 transition-all duration-150"
        />
      </div>

      {/* Right side profile & icons */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Messages Shortcut */}
        <button 
          onClick={() => alert("Check Messages Module on Sidebar")}
          className="hidden sm:flex w-10 h-10 rounded-full border border-gray-200 items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-[#0c4cb3] cursor-pointer transition-colors"
          title="Messages"
        >
          <MessageSquare size={16} />
        </button>

        {/* Notifications */}
        <button 
          onClick={() => alert("Notifications: 3 New Bills Generated Today!")}
          className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-red-500 relative cursor-pointer transition-colors"
          title="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
            3
          </span>
        </button>

        {/* Help */}
        <button 
          onClick={() => alert("MS Billing System Guide:\nUse the sidebar to navigate.\nYour database automatically syncs securely with Cloud Firestore in real-time.")}
          className="hidden sm:flex w-10 h-10 rounded-full border border-gray-200 items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-[#0c4cb3] cursor-pointer transition-colors"
          title="Help & Support"
        >
          <HelpCircle size={16} />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-1 sm:pl-3 border-l border-transparent sm:border-gray-200">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0c4cb3] to-[#1e5dd5] text-white flex items-center justify-center font-bold text-sm shadow-md">
            AD
          </div>
          <div className="hidden lg:block text-left">
            <h4 className="text-xs font-bold text-gray-800 leading-none">Admin</h4>
            <p className="text-[10px] text-gray-500 truncate max-w-28 mt-0.5" title={userEmail}>
              {userEmail}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
