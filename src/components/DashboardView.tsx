import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { 
  ShoppingBag, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Users, 
  Package, 
  Plus, 
  FileText, 
  IndianRupee 
} from "lucide-react";
import { Client, Product, Invoice } from "../types";

interface DashboardViewProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  onNavigateToBilling: () => void;
}

export default function DashboardView({ clients, products, invoices, onNavigateToBilling }: DashboardViewProps) {
  // 1. Calculations
  const todayStr = new Date().toISOString().split("T")[0];
  const thisMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  // Today's Sales
  const todaySales = invoices
    .filter(inv => inv.date === todayStr)
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Monthly Sales
  const monthlySales = invoices
    .filter(inv => inv.date.startsWith(thisMonthStr))
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Pending Payments
  const pendingPayments = invoices
    .filter(inv => inv.status !== "Paid")
    .reduce((sum, inv) => sum + (inv.status === "Partial" ? inv.amount * 0.5 : inv.amount), 0);

  // Paid Invoices count
  const paidInvoicesCount = invoices.filter(inv => inv.status === "Paid").length;

  // Chart Data: Sales per week/month (group by date)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const barChartData = last7Days.map(date => {
    const dayAmount = invoices
      .filter(inv => inv.date === date)
      .reduce((sum, inv) => sum + inv.amount, 0);
    const label = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { name: label, amount: dayAmount };
  });

  // Outstanding Aging Calculation for Donut Chart
  const agingData = [
    { name: "0-30 Days", value: 0, color: "#ef4444" },
    { name: "31-60 Days", value: 0, color: "#f97316" },
    { name: "61-90 Days", value: 0, color: "#eab308" },
    { name: "90+ Days", value: 0, color: "#10b981" },
  ];

  invoices.forEach(inv => {
    if (inv.status !== "Paid") {
      const invDate = new Date(inv.date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - invDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const value = inv.status === "Partial" ? inv.amount * 0.5 : inv.amount;

      if (diffDays <= 30) agingData[0].value += value;
      else if (diffDays <= 60) agingData[1].value += value;
      else if (diffDays <= 90) agingData[2].value += value;
      else agingData[3].value += value;
    }
  });

  // If no outstanding data, provide placeholder values so chart looks good
  const hasOutstanding = agingData.some(d => d.value > 0);
  const pieChartData = hasOutstanding 
    ? agingData.filter(d => d.value > 0)
    : [
        { name: "0-30 Days", value: 3000, color: "#ef4444" },
        { name: "31-60 Days", value: 2000, color: "#f97316" },
        { name: "61-90 Days", value: 1500, color: "#eab308" },
        { name: "90+ Days", value: 1000, color: "#10b981" },
      ];

  const totalOutstanding = agingData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col gap-6 select-none animate-fadeIn">
      {/* Welcome Title Banner */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Welcome back, Admin 👋</h2>
          <p className="text-xs text-gray-500 mt-1">Here is a real-time, cloud-synchronized overview of your billing metrics.</p>
        </div>
        <button
          onClick={onNavigateToBilling}
          className="bg-[#0c4cb3] hover:bg-[#073b99] text-white font-semibold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-[#0c4cb3]/10 cursor-pointer"
        >
          <Plus size={16} />
          <span>New Invoice</span>
        </button>
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0c4cb3] flex items-center justify-center mb-3">
            <ShoppingBag size={18} />
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Today's Sales</h3>
            <p className="text-base font-bold text-gray-850 mt-1 truncate">₹{todaySales.toLocaleString()}</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-3">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Monthly Sales</h3>
            <p className="text-base font-bold text-gray-850 mt-1 truncate">₹{monthlySales.toLocaleString()}</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mb-3">
            <Clock size={18} />
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Pending Pyts</h3>
            <p className="text-base font-bold text-gray-850 mt-1 truncate">₹{pendingPayments.toLocaleString()}</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
            <CheckCircle size={18} />
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Paid Bills</h3>
            <p className="text-base font-bold text-gray-850 mt-1">{paidInvoicesCount}</p>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center mb-3">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Clients</h3>
            <p className="text-base font-bold text-gray-850 mt-1">{clients.length}</p>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <Package size={18} />
          </div>
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Stock Catalog</h3>
            <p className="text-base font-bold text-gray-850 mt-1">{products.length}</p>
          </div>
        </div>
      </div>

      {/* Charts section: Grid in 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#0c4cb3]" />
            <span>Sales Overview (Last 7 Days)</span>
          </h3>
          <div className="flex-1 w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip 
                  formatter={(val) => [`₹${val}`, "Sales"]}
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff" }}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Outstanding Age Donut Chart */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-red-500" />
            <span>Outstanding Invoices Aging</span>
          </h3>
          <div className="flex-grow flex items-center gap-6">
            <div className="w-[45%] h-52 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    innerRadius="65%"
                    outerRadius="85%"
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`₹${val}`, "Aging"]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Abs center overlay label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total</span>
                <span className="text-base font-extrabold text-gray-800">₹{totalOutstanding.toLocaleString()}</span>
              </div>
            </div>

            {/* Legend info list */}
            <div className="w-[55%] flex flex-col justify-center gap-3">
              {agingData.map((item) => (
                <div key={item.name} className="flex justify-between items-center text-xs font-medium text-gray-600 border-b border-gray-50 pb-2 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span>{item.name}</span>
                  </div>
                  <span className="font-bold text-gray-800">₹{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lower Recent Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Invoices Table (Span 8) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[300px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText size={16} className="text-[#0c4cb3]" />
              <span>Recent Invoices</span>
            </h3>
            <span className="text-xs font-bold text-[#0c4cb3] bg-blue-50 px-2.5 py-1 rounded-lg">Cloud Active</span>
          </div>

          <div className="flex-1 overflow-x-auto">
            {invoices.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                <FileText size={40} className="mb-2 opacity-50" />
                <p className="text-xs">No invoices generated yet.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Inv No.</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Client Name</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Date</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Amount</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-xs font-semibold text-[#0c4cb3]">{inv.invoiceNo}</td>
                      <td className="p-3 text-xs font-medium text-gray-700">{inv.clientName}</td>
                      <td className="p-3 text-xs text-gray-500">
                        {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="p-3 text-xs font-bold text-gray-850">₹{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          inv.status === "Paid" 
                            ? "bg-green-100 text-green-850" 
                            : inv.status === "Unpaid"
                            ? "bg-red-100 text-red-850"
                            : "bg-amber-100 text-amber-850"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Activity/Payments (Span 4) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[300px]">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <IndianRupee size={16} className="text-green-500" />
            <span>Recent Payments</span>
          </h3>
          <div className="flex-1 flex flex-col gap-3 justify-start">
            {invoices.filter(i => i.status === "Paid" || i.status === "Partial").length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10 flex-1">
                <IndianRupee size={40} className="mb-2 opacity-50" />
                <p className="text-xs">No payments recorded yet.</p>
              </div>
            ) : (
              invoices
                .filter(i => i.status === "Paid" || i.status === "Partial")
                .slice(0, 4)
                .map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 bg-gray-50/50 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0c4cb3] flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                        {inv.clientName.substring(0, 2)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-850 leading-none">{inv.clientName}</h4>
                        <p className="text-[9px] text-gray-500 mt-1">{inv.invoiceNo} • {inv.paymentMode}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-green-600">+ ₹{inv.amount.toLocaleString()}</p>
                      <p className="text-[9px] text-gray-400 mt-1">Recorded</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
