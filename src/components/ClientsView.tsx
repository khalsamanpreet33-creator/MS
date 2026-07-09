import React, { useState } from "react";
import { Plus, Search, Trash2, Phone, Mail, FileText, User } from "lucide-react";
import { Client } from "../types";

interface ClientsViewProps {
  clients: Client[];
  onAddClient: (clientData: Omit<Client, "id" | "createdAt">) => Promise<void>;
  onDeleteClient: (id: string) => Promise<void>;
}

export default function ClientsView({ clients, onAddClient, onDeleteClient }: ClientsViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form Fields
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [mobile, setMobile] = useState("");
  const [gst, setGst] = useState("");
  const [email, setEmail] = useState("");
  const [balance, setBalance] = useState("0.00");

  const [isSubmitting, setIsFormSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !mobile.trim()) {
      alert("Company Name and Mobile Number are required!");
      return;
    }

    try {
      setIsFormSubmitting(true);
      await onAddClient({
        name: name.trim(),
        company: company.trim(),
        mobile: mobile.trim(),
        gst: gst.trim().toUpperCase(),
        email: email.trim(),
        balance: parseFloat(balance) || 0,
      });

      // Reset form
      setName("");
      setCompany("");
      setMobile("");
      setGst("");
      setEmail("");
      setBalance("0.00");
      setIsFormOpen(false);
      alert("Client profile successfully written to real-time database!");
    } catch (err: any) {
      console.error(err);
      alert("Database write error: " + err.message);
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; clientName: string }>({ isOpen: false, id: "", clientName: "" });

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await onDeleteClient(deleteConfirm.id);
      // Removed alert
    } catch (err: any) {
      console.error(err);
      // Fallback
    } finally {
      setDeleteConfirm({ isOpen: false, id: "", clientName: "" });
    }
  };

  const handleDelete = (id: string, clientName: string) => {
    setDeleteConfirm({ isOpen: true, id, clientName });
  };

  // Searching logic
  const filteredClients = clients.filter(client => {
    const q = searchQuery.toLowerCase();
    return (
      client.company.toLowerCase().includes(q) ||
      client.name.toLowerCase().includes(q) ||
      client.mobile.includes(q) ||
      client.gst.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none">
      {/* View Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Clients Database</h2>
          <p className="text-xs text-gray-500 mt-1">Manage accounts ledger, GSTIN data and outstanding dynamic balance.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-gradient-to-r from-[#1e5dd5] to-[#0b4ebd] hover:scale-[1.02] text-white font-semibold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#0b4ebd]/20"
        >
          <Plus size={16} />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Slide-down client entry form */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm animate-slideDown">
          <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Enter Client Profile</h3>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Client / Company Name *</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Sharma Logistics"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Contact Person Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amit Sharma"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Mobile Number *</label>
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10 digit mobile"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">GSTIN Number</label>
                <input
                  type="text"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  placeholder="09XXXXX1234F1Z1"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@domain.com"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#0b4ebd] hover:bg-[#073b99] disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-[#0b4ebd]/10"
              >
                {isSubmitting ? "Saving to Cloud..." : "Save to Database"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        {/* Table top filtration actions */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name, phone, or GST..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/5 transition-all"
            />
          </div>
          <span className="text-xs font-semibold text-gray-500">
            Total Accounts: <strong className="text-gray-800 font-bold">{filteredClients.length}</strong>
          </span>
        </div>

        {/* Clients Table Ledger */}
        <div className="overflow-x-auto">
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-16">
              <User size={48} className="mb-2 opacity-50 text-gray-300" />
              <p className="text-xs">No matching client entries found in your database.</p>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="mt-3 text-xs font-bold text-[#0b4ebd] hover:underline"
              >
                Create your first account
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Client / Company Name</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Contact Person</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Mobile</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">GSTIN</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Email Address</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Outstanding Balance</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => {
                  const bal = client.balance || 0;
                  const isPositive = bal > 0;
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-xs font-bold text-gray-850">{client.company}</td>
                      <td className="p-4 text-xs font-medium text-gray-700">{client.name || "—"}</td>
                      <td className="p-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Phone size={11} className="text-gray-400" />
                          <span>{client.mobile}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs">
                        <code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-semibold font-mono">
                          {client.gst || "URP"}
                        </code>
                      </td>
                      <td className="p-4 text-xs text-gray-600">
                        {client.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail size={11} className="text-gray-400" />
                            <span>{client.email}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="p-4 text-xs">
                        <span className={`inline-block px-2.5 py-1 rounded-lg font-semibold ${
                          isPositive 
                            ? "bg-red-50 text-red-600 border border-red-100" 
                            : "bg-green-50 text-green-600 border border-green-100"
                        }`}>
                          ₹{bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-center">
                        <button
                          onClick={() => handleDelete(client.id, client.company)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                          title="Delete Profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Custom Delete Confirm Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Client?</h3>
              <p className="text-sm text-gray-500">Are you sure you want to completely remove "{deleteConfirm.clientName}" from your database?</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, id: "", clientName: "" })}
                className="flex-1 py-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-4 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors border-l border-gray-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
