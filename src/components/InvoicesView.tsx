import React, { useState } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  Printer, 
  Mail, 
  MessageSquare, 
  X, 
  ChevronRight, 
  Calendar, 
  User, 
  CreditCard,
  Barcode
} from "lucide-react";
import { Client, Product, Invoice, InvoiceItem, CompanySettings } from "../types";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface InvoicesViewProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  companySettings: CompanySettings | null;
  onAddInvoice: (invoiceData: Omit<Invoice, "id" | "createdAt">) => Promise<void>;
  onDeleteInvoice: (id: string) => Promise<void>;
}

const DUMMY_CLIENTS: Client[] = [
  {
    id: "dummy-client-1",
    name: "Manpreet Singh",
    company: "Khalsa Solutions (Demo Client)",
    mobile: "9876543210",
    gst: "09KHALSA1234F1Z1",
    email: "khalsa.manpreet33@gmail.com",
    balance: 15400,
    createdAt: new Date().toISOString()
  }
];

const DUMMY_PRODUCTS: Product[] = [
  {
    id: "dummy-prod-1",
    name: "Core i5 Computer CPU Assembly (Demo Product)",
    type: "Product",
    hsn: "84713010",
    rate: 28500,
    stock: 12,
    createdAt: new Date().toISOString()
  },
  {
    id: "dummy-prod-2",
    name: "Wireless Optical Mouse 2.4GHz (Demo Product)",
    type: "Product",
    hsn: "84716060",
    rate: 850,
    stock: 45,
    createdAt: new Date().toISOString()
  },
  {
    id: "dummy-prod-3",
    name: "Full Hardware Diagnostics & Repair (Demo Service)",
    type: "Service",
    hsn: "998713",
    rate: 1500,
    stock: 0,
    createdAt: new Date().toISOString()
  }
];

export default function InvoicesView({ 
  clients, 
  products, 
  invoices, 
  companySettings, 
  onAddInvoice, 
  onDeleteInvoice 
}: InvoicesViewProps) {
  const activeClients = clients.length > 0 ? clients : DUMMY_CLIENTS;
  const activeProducts = products.length > 0 ? products : DUMMY_PRODUCTS;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // New Invoice form state
  const [clientIndex, setClientIndex] = useState("");
  const [status, setStatus] = useState<"Paid" | "Unpaid" | "Partial">("Unpaid");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Bank">("UPI");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<{ productName: string; rate: number; qty: number }[]>([
    { productName: "", rate: 0, qty: 1 }
  ]);
  const [discount, setDiscount] = useState(0);
  const [gstRate, setGstRate] = useState(0);

  const handleAutofillDummy = () => {
    if (activeClients.length > 0) {
      setClientIndex("0");
    }
    
    const defaultRows = [];
    if (activeProducts.length > 0) {
      defaultRows.push({ productName: activeProducts[0].name, rate: activeProducts[0].rate, qty: 1 });
    }
    if (activeProducts.length > 1) {
      defaultRows.push({ productName: activeProducts[1].name, rate: activeProducts[1].rate, qty: 2 });
    } else if (activeProducts.length === 1) {
      defaultRows.push({ productName: activeProducts[0].name, rate: activeProducts[0].rate, qty: 2 });
    }
    
    setRows(defaultRows.length > 0 ? defaultRows : [{ productName: "", rate: 0, qty: 1 }]);
    setStatus("Unpaid");
    setPaymentMode("UPI");
    setDiscount(0);
    setGstRate(18);
  };

  const [isSaving, setIsSaving] = useState(false);

  // Rows handling
  const handleAddRow = () => {
    setRows(prev => [...prev, { productName: "", rate: 0, qty: 1 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: "productName" | "rate" | "qty", value: any) => {
    setRows(prev => {
      const updated = [...prev];
      if (field === "productName") {
        const prodName = value as string;
        updated[index].productName = prodName;
        const prod = activeProducts.find(p => p.name === prodName);
        if (prod) {
          updated[index].rate = prod.rate;
        }
      } else if (field === "rate") {
        updated[index].rate = parseFloat(value) || 0;
      } else if (field === "qty") {
        updated[index].qty = parseInt(value) || 0;
      }
      return updated;
    });
  };

  // Grand total calculation for form
  const computedInvoiceItems = rows
    .filter(row => row.productName.trim() !== "")
    .map(row => {
      return {
        name: row.productName,
        rate: row.rate,
        qty: row.qty,
        total: row.rate * row.qty
      } as InvoiceItem;
    });

  const subTotalAmount = computedInvoiceItems.reduce((sum, item) => sum + item.total, 0);
  const taxableAmount = Math.max(0, subTotalAmount - discount);
  const calculatedGst = (taxableAmount * gstRate) / 100;
  const grandTotal = taxableAmount + calculatedGst;

  // Submit invoice
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientIndex) {
      alert("Please select a valid client first!");
      return;
    }
    if (computedInvoiceItems.length === 0) {
      alert("Please add at least one valid product/service row!");
      return;
    }

    const selectedClient = activeClients[parseInt(clientIndex)];
    if (!selectedClient) return;

    try {
      setIsSaving(true);
      
      // Auto generate invoice number (e.g. INV-2026-X)
      const nextNum = invoices.length + 101;
      const invoiceNo = `INV-2026-${nextNum}`;

      await onAddInvoice({
        invoiceNo,
        clientName: selectedClient.company,
        clientMobile: selectedClient.mobile,
        date: invoiceDate,
        subTotal: subTotalAmount,
        discount: discount,
        gstRate: gstRate,
        amount: grandTotal,
        status,
        paymentMode,
        items: computedInvoiceItems
      });

      // Clear Form state
      setClientIndex("");
      setStatus("Unpaid");
      setPaymentMode("UPI");
      setDiscount(0);
      setGstRate(0);
      setRows([{ productName: "", rate: 0, qty: 1 }]);
      setIsFormOpen(false);
      alert("Invoice successfully synchronized and processed!");
    } catch (err: any) {
      console.error(err);
      alert("Cloud synchronization failure: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; invNo: string }>({ isOpen: false, id: "", invNo: "" });

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await onDeleteInvoice(deleteConfirm.id);
      // Removed alert to avoid iframe blocking
    } catch (err: any) {
      console.error(err);
      // Fallback
    } finally {
      setDeleteConfirm({ isOpen: false, id: "", invNo: "" });
    }
  };

  const handleDelete = (id: string, invNo: string) => {
    setDeleteConfirm({ isOpen: true, id, invNo });
  };

  // Share bill / Reminder wrappers
  const handleWhatsApp = (inv: Invoice) => {
    const companyName = companySettings?.compName || "MS Enterprises";
    const currencySymbol = companySettings?.compCurr?.split(" - ")[0] || "₹";
    
    let itemsText = "";
    if (inv.items && inv.items.length > 0) {
      itemsText = "\n*Items:* \n" + inv.items.map((item, index) => {
        return `${index + 1}. ${item.name} (${item.qty} x ${currencySymbol}${item.rate.toLocaleString()}) = ${currencySymbol}${item.total.toLocaleString()}`;
      }).join("\n");
    }

    const subTotalText = `*Subtotal:* ${currencySymbol}${(inv.subTotal ?? inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const discountText = inv.discount ? `\n*Discount:* -${currencySymbol}${inv.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";
    const gstText = inv.gstRate ? `\n*GST (${inv.gstRate}%):* +${currencySymbol}${(((inv.subTotal ?? inv.amount) - (inv.discount ?? 0)) * inv.gstRate / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";

    const statusText = inv.status === "Paid" ? "✅ PAID" : `⚠️ UNPAID (${inv.status})`;
    const headerText = inv.status === "Paid" ? `*INVOICE RECEIPT - ${inv.invoiceNo}*` : `*INVOICE BILL - ${inv.invoiceNo}*`;

    const defaultText = `${headerText}
---------------------------------------
*Company:* ${companyName}
*Date:* ${new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
*Client:* ${inv.clientName}
*Status:* ${statusText}
${itemsText}

${subTotalText}${discountText}${gstText}
*Grand Total:* *${currencySymbol}${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}*
---------------------------------------
${companySettings?.invoiceGreet || "Thank you for your business!"}
_Powered by ${companyName}_`;

    const cleanMobile = inv.clientMobile.replace(/[^0-9]/g, "");
    let formattedMobile = cleanMobile;
    if (cleanMobile.length === 10) {
      formattedMobile = "91" + cleanMobile;
    }
    const url = `https://wa.me/${formattedMobile}?text=${encodeURIComponent(defaultText)}`;
    window.open(url, "_blank");
  };

  const handleEmail = (inv: Invoice) => {
    const cli = activeClients.find(c => c.company === inv.clientName || c.name === inv.clientName);
    const email = cli?.email || "";
    if (!email) {
      alert("This client does not have an email profile listed.");
      return;
    }

    const companyName = companySettings?.compName || "MS Enterprises";
    const currencySymbol = companySettings?.compCurr?.split(" - ")[0] || "₹";
    
    let itemsText = "";
    if (inv.items && inv.items.length > 0) {
      itemsText = "Items:\n" + inv.items.map((item, index) => {
        return `  - ${item.name} (${item.qty} x ${currencySymbol}${item.rate.toLocaleString()}) = ${currencySymbol}${item.total.toLocaleString()}`;
      }).join("\n");
    }

    const subTotalText = `Subtotal: ${currencySymbol}${(inv.subTotal ?? inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const discountText = inv.discount ? `\nDiscount: -${currencySymbol}${inv.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";
    const gstText = inv.gstRate ? `\nGST (${inv.gstRate}%): +${currencySymbol}${(((inv.subTotal ?? inv.amount) - (inv.discount ?? 0)) * inv.gstRate / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";

    const subject = inv.status === "Paid" 
      ? `Invoice Payment Receipt - ${inv.invoiceNo} from ${companyName}`
      : `Outstanding Bill Invoice - ${inv.invoiceNo} from ${companyName}`;

    const body = `Dear Customer,

Please find the invoice details for your transaction with ${companyName}.

Invoice Number: ${inv.invoiceNo}
Date: ${new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
Client: ${inv.clientName}
Payment Status: ${inv.status}
Payment Mode: ${inv.paymentMode}

---------------------------------------------------------
${itemsText}
---------------------------------------------------------

${subTotalText}${discountText}${gstText}
Grand Total: ${currencySymbol}${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}

${companySettings?.bankName ? `
Bank Settlement Info:
Bank: ${companySettings.bankName}
Account Holder: ${companySettings.bankHolder}
Account Number: ${companySettings.bankAccNo}
IFSC Code: ${companySettings.bankIfsc}
Branch: ${companySettings.bankBranch}
` : ''}

${companySettings?.invoiceTerms ? `
Terms & Conditions:
${companySettings.invoiceTerms}
` : ''}

${companySettings?.invoiceGreet || "Thank you for your business!"}

Sincerely,
${companyName}`;

    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handlePrintInvoice = async () => {
    const printElement = document.getElementById("invoicePrintArea");
    if (!printElement) return;

    try {
      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${selectedInvoice?.invoiceNo || "Document"}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      // Fallback
      window.print();
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      inv.clientMobile.includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none print:bg-white print:p-0">
      {/* Page header (Hides on standard print mode) */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Invoices & Billing</h2>
          <p className="text-xs text-gray-500 mt-1">Create estimates, generate GST-compliant invoices, track pending liabilities and payment methods.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-gradient-to-r from-[#1e5dd5] to-[#0b4ebd] hover:scale-[1.02] text-white font-semibold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#0b4ebd]/20"
        >
          <Plus size={16} />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Invoice creator form panel */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm animate-slideDown print:hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Create New Bill Invoice</h3>
            <button
              type="button"
              onClick={handleAutofillDummy}
              className="text-xs font-semibold text-[#0b4ebd] hover:bg-blue-50 px-3.5 py-2 rounded-xl border border-[#0b4ebd]/20 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>✨ Autofill Dummy Data (Preview)</span>
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Select Client *</label>
                <select
                  value={clientIndex}
                  onChange={(e) => setClientIndex(e.target.value)}
                  required
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] cursor-pointer"
                >
                  <option value="">-- Choose Account --</option>
                  {activeClients.map((cli, idx) => (
                    <option key={cli.id} value={idx}>
                      {cli.company} ({cli.name || "N/A"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Payment Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white cursor-pointer"
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Payment Method</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white cursor-pointer"
                >
                  <option value="UPI">UPI Payment</option>
                  <option value="Cash">Hard Cash</option>
                  <option value="Bank">Bank Deposit</option>
                </select>
              </div>
            </div>

            {/* Invoiced rows selector items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h4 className="text-xs font-bold text-gray-600">Product / Service Billing Lines</h4>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-xs font-bold text-[#0b4ebd] hover:text-[#073b99] flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Line</span>
                </button>
              </div>

              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end animate-fadeIn">
                  <div className="md:col-span-6 flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-semibold text-gray-400">Item Name</label>
                    <input
                      list="invoice-products"
                      value={row.productName}
                      onChange={(e) => handleRowChange(idx, "productName", e.target.value)}
                      placeholder="Type or select product/service..."
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white cursor-pointer"
                    />
                    <datalist id="invoice-products">
                      {activeProducts.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name} (₹{item.rate})
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div className="md:col-span-3 flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-semibold text-gray-400">Billing Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={row.rate || ""}
                      onChange={(e) => handleRowChange(idx, "rate", e.target.value)}
                      placeholder="0.00"
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-semibold text-gray-400">Quantity</label>
                    <input
                      type="number"
                      value={row.qty || ""}
                      onChange={(e) => handleRowChange(idx, "qty", e.target.value)}
                      placeholder="1"
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white"
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-center pb-1">
                    <button
                      type="button"
                      disabled={rows.length === 1}
                      onClick={() => handleRemoveRow(idx)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount and GST Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-150">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-semibold text-gray-400">Discount Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-semibold text-gray-400">GST Rate (%)</label>
                <input
                  type="number"
                  step="1"
                  value={gstRate}
                  onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 18"
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* Total Balance computed Box */}
            <div className="flex flex-col gap-2 bg-gray-50 p-4 rounded-xl border border-gray-150">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Subtotal</span>
                <span className="text-xs font-semibold text-gray-700">
                  ₹{subTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-green-600">
                  <span className="text-[10px] font-bold uppercase">Discount</span>
                  <span className="text-xs font-semibold">
                    -₹{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {gstRate > 0 && (
                <div className="flex justify-between items-center text-gray-600">
                  <span className="text-[10px] font-bold uppercase">GST ({gstRate}%)</span>
                  <span className="text-xs font-semibold">
                    +₹{calculatedGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase">Grand Total</span>
                <span className="text-base font-extrabold text-[#0b4ebd]">
                  ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
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
                disabled={isSaving}
                className="px-5 py-2.5 bg-[#0b4ebd] hover:bg-[#073b99] disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-[#0b4ebd]/10"
              >
                {isSaving ? "Saving Invoice..." : "Publish Invoice"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tables representation list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col print:hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoices by invoice number or client..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/5 transition-all"
            />
          </div>
          <span className="text-xs font-semibold text-gray-500">
            Total Ledger: <strong className="text-gray-800 font-bold">{filteredInvoices.length}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-16">
              <FileText size={48} className="mb-2 opacity-50 text-gray-300" />
              <p className="text-xs">No invoices generated yet in this billing system.</p>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="mt-3 text-xs font-bold text-[#0b4ebd] hover:underline"
              >
                Create your first invoice
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Inv No.</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Client / Company</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Date</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Amount</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">Reminders / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((inv) => {
                  const amt = inv.amount || 0;
                  const isPaid = inv.status === "Paid";
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-xs font-bold text-[#0c4cb3] cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                        {inv.invoiceNo}
                      </td>
                      <td className="p-4 text-xs font-medium text-gray-800">{inv.clientName}</td>
                      <td className="p-4 text-xs text-gray-500">
                        {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="p-4 text-xs font-bold text-gray-850">
                        ₹{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-xs">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          isPaid 
                            ? "bg-green-50 text-green-700 border border-green-100" 
                            : inv.status === "Unpaid"
                            ? "bg-red-50 text-red-700 border border-red-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-center flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 p-2 rounded-lg cursor-pointer transition-colors text-xs font-bold flex items-center gap-1"
                          title="View Invoice Sheet"
                        >
                          <ChevronRight size={14} />
                          <span>View Sheet</span>
                        </button>

                        <button
                          onClick={() => handleWhatsApp(inv)}
                          className="text-green-600 hover:bg-green-50 p-2 rounded-lg cursor-pointer transition-colors"
                          title={isPaid ? "Send Receipt via WhatsApp" : "Send Bill / Reminder via WhatsApp"}
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => handleEmail(inv)}
                          className="text-orange-500 hover:bg-orange-50 p-2 rounded-lg cursor-pointer transition-colors"
                          title={isPaid ? "Send Receipt via Email" : "Send Bill / Reminder via Email"}
                        >
                          <Mail size={14} />
                        </button>

                        <button
                          onClick={() => handleDelete(inv.id, inv.invoiceNo)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg cursor-pointer transition-colors"
                          title="Delete Ledger Entry"
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

      {/* Invoice Sheet View Overlay Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:absolute print:inset-0 print:bg-white select-none">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl relative animate-scaleUp print:h-auto print:max-h-none print:shadow-none print:border-none print:m-0 print:rounded-none">
            {/* Modal Controls Bar (Hides on standard print mode) */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center p-4 border-b border-gray-150 bg-gray-50/50 rounded-t-2xl print:hidden">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                <FileText size={16} className="text-[#0c4cb3]" />
                <span>Invoice Sheet : {selectedInvoice.invoiceNo}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleWhatsApp(selectedInvoice)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm shadow-green-600/10"
                  title="Send via WhatsApp"
                >
                  <MessageSquare size={14} />
                  <span>Send WhatsApp</span>
                </button>
                <button
                  onClick={() => handleEmail(selectedInvoice)}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm shadow-orange-500/10"
                  title="Send via Email"
                >
                  <Mail size={14} />
                  <span>Send Email</span>
                </button>
                <button
                  onClick={handlePrintInvoice}
                  className="bg-[#0b4ebd] hover:bg-[#073b99] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[#0b4ebd]/10"
                >
                  <Printer size={14} />
                  <span>Print / PDF</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-500 hover:bg-gray-100 hover:text-gray-800 p-2 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Print Area start */}
            <div id="invoicePrintArea" className="p-8 space-y-6 flex-1 text-left print:p-0 print:m-0">
              
              {/* Top corporate block Header */}
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  {companySettings?.logoUrl ? (
                    <img src={companySettings.logoUrl} alt="Logo" className="h-12 object-contain mb-2" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-100 text-[#0c4cb3] font-black italic flex items-center justify-center text-lg mb-2">MS</div>
                  )}
                  <h3 className="text-base font-bold text-gray-800">{companySettings?.compName || "MS Enterprises"}</h3>
                  <p className="text-[10px] text-gray-500 leading-relaxed whitespace-pre-line">{companySettings?.compAddr || "Bareilly, Uttar Pradesh, India"}</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">Phone: {companySettings?.compPhone || "+91 98765 43210"} | Website: {companySettings?.compWeb || "www.msenterprises.com"}</p>
                  {companySettings?.compGst && (
                    <p className="text-[10px] font-bold text-[#0c4cb3] mt-1 font-mono">GSTIN: {companySettings.compGst}</p>
                  )}
                </div>

                <div className="text-right space-y-1.5 border border-blue-50 bg-blue-50/20 p-4 rounded-xl print:border-none print:p-0">
                  <h2 className="text-lg font-black tracking-tight text-[#0c4cb3] uppercase">TAX INVOICE</h2>
                  <p className="text-xs font-bold text-gray-800">No: {selectedInvoice.invoiceNo}</p>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1 justify-end">
                    <Calendar size={11} />
                    <span>Date: {new Date(selectedInvoice.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </p>
                  <span className={`inline-block px-2.5 py-0.5 rounded font-bold text-[9px] uppercase mt-1 ${
                    selectedInvoice.status === "Paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    Payment : {selectedInvoice.status}
                  </span>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Client Billed properties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100 print:bg-white print:border-none print:p-0">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400">Billed To (Recipient)</span>
                  <h4 className="text-xs font-bold text-gray-800">{selectedInvoice.clientName}</h4>
                  <p className="text-[10px] text-gray-500">Contact person info listed in records</p>
                  <p className="text-[10px] text-gray-600 font-medium">Mobile: +91 {selectedInvoice.clientMobile}</p>
                </div>
                <div className="space-y-1 text-left md:text-right">
                  <span className="text-[9px] uppercase font-bold text-gray-400">Payment Routing Info</span>
                  <p className="text-[10px] text-gray-600 font-medium">Settlement Mode: {selectedInvoice.paymentMode}</p>
                  <p className="text-[10px] text-gray-500">All prices listed in {companySettings?.compCurr?.split(" - ")[0] || "INR"}</p>
                </div>
              </div>

              {/* Row Items Grid Table representation */}
              <div className="border border-gray-150 rounded-xl overflow-hidden print:border-collapse">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0c4cb3]/5 border-b border-gray-200">
                      <th className="p-3 text-[9px] font-bold uppercase tracking-wider text-gray-600">S.No</th>
                      <th className="p-3 text-[9px] font-bold uppercase tracking-wider text-gray-600">Description of Items / Services</th>
                      <th className="p-3 text-[9px] font-bold uppercase tracking-wider text-gray-600 text-right">Unit Rate</th>
                      <th className="p-3 text-[9px] font-bold uppercase tracking-wider text-gray-600 text-right">Qty</th>
                      <th className="p-3 text-[9px] font-bold uppercase tracking-wider text-gray-600 text-right">Row Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedInvoice.items?.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-[11px] text-gray-500 font-medium">{index + 1}</td>
                        <td className="p-3 text-[11px] font-semibold text-gray-850">{item.name}</td>
                        <td className="p-3 text-[11px] text-gray-600 text-right font-medium">₹{item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-[11px] text-gray-600 text-right font-medium">{item.qty} Units</td>
                        <td className="p-3 text-[11px] font-extrabold text-gray-800 text-right">₹{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {/* Bottom compute calculation boxes */}
                    <tr className="bg-gray-50/50">
                      <td colSpan={3} className="p-2 border-r border-gray-150"></td>
                      <td className="p-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide text-right">Subtotal</td>
                      <td className="p-2 text-xs font-semibold text-gray-700 text-right">
                        ₹{(selectedInvoice.subTotal ?? selectedInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {!!selectedInvoice.discount && selectedInvoice.discount > 0 && (
                      <tr className="bg-white">
                        <td colSpan={3} className="p-2 border-r border-gray-150"></td>
                        <td className="p-2 text-[10px] font-bold text-green-600 uppercase tracking-wide text-right">Discount</td>
                        <td className="p-2 text-xs font-semibold text-green-600 text-right">
                          -₹{selectedInvoice.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    {!!selectedInvoice.gstRate && selectedInvoice.gstRate > 0 && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={3} className="p-2 border-r border-gray-150"></td>
                        <td className="p-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide text-right">GST ({selectedInvoice.gstRate}%)</td>
                        <td className="p-2 text-xs font-semibold text-gray-700 text-right">
                          +₹{(((selectedInvoice.subTotal ?? selectedInvoice.amount) - (selectedInvoice.discount ?? 0)) * selectedInvoice.gstRate / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-blue-50/30">
                      <td colSpan={3} className="p-3 border-r border-gray-150"></td>
                      <td className="p-3 text-[10px] font-bold text-gray-800 uppercase tracking-wide text-right">Grand Total Due</td>
                      <td className="p-3 text-sm font-black text-[#0c4cb3] text-right">
                        ₹{selectedInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Lower Section for bank + signature and pay QR image */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
                
                {/* Columns block 1: Bank Details & Footer settings terms (Span 8) */}
                <div className="md:col-span-7 text-left space-y-4">
                  {companySettings?.bankName && (
                    <div className="p-3 bg-gray-50/70 border border-gray-150 rounded-xl space-y-1">
                      <span className="text-[9px] uppercase font-bold text-gray-400">Electronic Bank Wire Settlement Info</span>
                      <h4 className="text-[10px] font-extrabold text-gray-800">{companySettings.bankName}</h4>
                      <p className="text-[9px] text-gray-600">A/c Holder: {companySettings.bankHolder} | Account No: {companySettings.bankAccNo}</p>
                      <p className="text-[9px] text-gray-600 font-mono uppercase">IFSC Code: {companySettings.bankIfsc} | Branch: {companySettings.bankBranch}</p>
                    </div>
                  )}

                  {companySettings?.invoiceTerms && (
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-gray-400">Declarations & T&C</span>
                      <p className="text-[9px] text-gray-500 whitespace-pre-line leading-relaxed">{companySettings.invoiceTerms}</p>
                    </div>
                  )}

                  <p className="text-[10px] font-bold text-[#0c4cb3] italic pt-1">{companySettings?.invoiceGreet || "Thank you for your business!"}</p>
                </div>

                {/* Columns block 2: Pay QR and digital sign (Span 5) */}
                <div className="md:col-span-5 flex flex-col items-center md:items-end justify-between gap-4">
                  {/* Dynamic pay-QR image base64 */}
                  {companySettings?.qrUrl ? (
                    <div className="flex flex-col items-center gap-1.5 p-2 border border-gray-100 bg-white rounded-xl text-center">
                      <img src={companySettings.qrUrl} alt="UPI QR" className="h-28 w-28 object-contain" />
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Scan & Pay via UPI</span>
                    </div>
                  ) : (
                    companySettings?.upiVpa && (
                      <div className="text-center md:text-right bg-blue-50/10 border border-dashed border-[#0c4cb3]/30 p-2.5 rounded-xl">
                        <span className="text-[8px] uppercase font-bold text-gray-400 block mb-0.5">UPI Merchant ID / VPA</span>
                        <code className="text-[9px] font-bold text-[#0c4cb3] font-mono">{companySettings.upiVpa}</code>
                      </div>
                    )
                  )}

                  {/* Digital Signature */}
                  {companySettings?.signUrl ? (
                    <div className="text-center md:text-right space-y-1 pt-4">
                      <img src={companySettings.signUrl} alt="Digital Sign" className="h-12 max-w-40 object-contain ml-auto" />
                      <span className="text-[9px] uppercase font-bold text-gray-400 block border-t border-gray-100 pt-1">Authorized Representative Signature</span>
                    </div>
                  ) : (
                    <div className="text-center md:text-right border-t border-gray-150 pt-3 w-48">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block">Authorized Signature</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirm Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Invoice?</h3>
              <p className="text-sm text-gray-500">Are you sure you want to delete invoice {deleteConfirm.invNo}?</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, id: "", invNo: "" })}
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
