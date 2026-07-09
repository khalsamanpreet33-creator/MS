import React, { useState } from "react";
import { Plus, Search, Trash2, Tag, Box, DollarSign } from "lucide-react";
import { Product } from "../types";

interface ProductsViewProps {
  products: Product[];
  onAddProduct: (productData: Omit<Product, "id" | "createdAt">) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
}

export default function ProductsView({ products, onAddProduct, onDeleteProduct }: ProductsViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form Fields
  const [name, setName] = useState("");
  const [type, setType] = useState<"Product" | "Service">("Product");
  const [hsn, setHsn] = useState("");
  const [rate, setRate] = useState("");
  const [stock, setStock] = useState("0");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedType = e.target.value as "Product" | "Service";
    setType(selectedType);
    if (selectedType === "Service") {
      setStock("0");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rate.trim()) {
      alert("Item Name and Rate are required!");
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddProduct({
        name: name.trim(),
        type,
        hsn: hsn.trim(),
        rate: parseFloat(rate) || 0,
        stock: type === "Product" ? parseInt(stock) || 0 : 0,
      });

      // Reset form
      setName("");
      setType("Product");
      setHsn("");
      setRate("");
      setStock("0");
      setIsFormOpen(false);
      alert("Product successfully added to cloud database!");
    } catch (err: any) {
      console.error(err);
      alert("Error adding item: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; itemName: string }>({ isOpen: false, id: "", itemName: "" });

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await onDeleteProduct(deleteConfirm.id);
      // Removed alert
    } catch (err: any) {
      console.error(err);
      // Fallback
    } finally {
      setDeleteConfirm({ isOpen: false, id: "", itemName: "" });
    }
  };

  const handleDelete = (id: string, itemName: string) => {
    setDeleteConfirm({ isOpen: true, id, itemName });
  };

  const filteredProducts = products.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.hsn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none">
      {/* View Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Products & Services</h2>
          <p className="text-xs text-gray-500 mt-1">Manage your inventory items, sales catalog, HSN/SAC codes, and service rates.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-gradient-to-r from-[#1e5dd5] to-[#0b4ebd] hover:scale-[1.02] text-white font-semibold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#0b4ebd]/20"
        >
          <Plus size={16} />
          <span>Add New Item</span>
        </button>
      </div>

      {/* Slide-down form card */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm animate-slideDown">
          <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">Enter Product / Service Profile</h3>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] uppercase font-bold text-gray-400">Item Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wireless Keyboard, Repairing Service"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Item Type *</label>
                <select
                  value={type}
                  onChange={handleTypeChange}
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all cursor-pointer"
                >
                  <option value="Product">Product</option>
                  <option value="Service">Service</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">HSN / SAC Code</label>
                <input
                  type="text"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  placeholder="e.g. 847130"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Rate (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.00"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Initial Stock Qty</label>
                <input
                  type="number"
                  disabled={type === "Service"}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/10 transition-all disabled:opacity-50 disabled:bg-gray-100"
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
                {isSubmitting ? "Saving..." : "Save to Database"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter actions and Table List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        {/* Search Header and Counters */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by name, HSN code..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/5 transition-all"
            />
          </div>
          <span className="text-xs font-semibold text-gray-500">
            Total Items: <strong className="text-gray-800 font-bold">{filteredProducts.length}</strong>
          </span>
        </div>

        {/* Catalog Table */}
        <div className="overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-16">
              <Box size={48} className="mb-2 opacity-50 text-gray-300" />
              <p className="text-xs">No matching catalogue items found.</p>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="mt-3 text-xs font-bold text-[#0b4ebd] hover:underline"
              >
                Insert product or service
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Item Name</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">HSN/SAC Code</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Rate (₹)</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Available Stock</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((item) => {
                  const rateValue = item.rate || 0;
                  const isProd = item.type === "Product";
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-xs font-bold text-gray-850">{item.name}</td>
                      <td className="p-4 text-xs">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold leading-none ${
                          isProd 
                            ? "bg-blue-50 text-[#0369a1] border border-blue-100" 
                            : "bg-amber-50 text-[#b45309] border border-amber-100"
                        }`}>
                          {isProd ? <Box size={10} /> : <Tag size={10} />}
                          <span>{item.type}</span>
                        </span>
                      </td>
                      <td className="p-4 text-xs">
                        {item.hsn ? (
                          <code className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-semibold font-mono">
                            {item.hsn}
                          </code>
                        ) : "—"}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-850">
                        ₹{rateValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-xs font-medium text-gray-600">
                        {isProd ? (
                          <span className={item.stock > 0 ? "text-gray-800" : "text-red-500 font-bold"}>
                            {item.stock} Units
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-center">
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                          title="Delete Item"
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
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Item?</h3>
              <p className="text-sm text-gray-500">Are you sure you want to completely remove "{deleteConfirm.itemName}" from your products catalog?</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, id: "", itemName: "" })}
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
