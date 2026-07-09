import React, { useState } from "react";
import { 
  Building, 
  Image as ImageIcon, 
  Building2, 
  FileText, 
  QrCode, 
  Globe, 
  MapPin, 
  Phone, 
  Mail, 
  Hash, 
  Check, 
  RotateCcw,
  Sparkles,
  CreditCard
} from "lucide-react";
import { CompanySettings } from "../types";

interface CompanySettingsViewProps {
  settings: CompanySettings | null;
  onSaveSettings: (settings: CompanySettings) => Promise<void>;
}

const DEFAULT_SETTINGS: CompanySettings = {
  compName: "MS Enterprises",
  compWeb: "www.msenterprises.com",
  compAddr: "123, Green Park Road,\nCivil Lines,\nBareilly - 243001\nUttar Pradesh, India",
  compState: "Uttar Pradesh",
  compCity: "Bareilly",
  compGst: "09ABCDE1234F1Z5",
  compPin: "243001",
  compPhone: "+91 98765 43210",
  compCountry: "India",
  compEmail: "info@msenterprises.com",
  compCurr: "INR - Indian Rupee (₹)",
  bankName: "State Bank of India",
  bankHolder: "MS Enterprises",
  bankAccNo: "302100054321",
  bankIfsc: "SBIN0001234",
  bankBranch: "Civil Lines Area",
  invoiceTerms: "1. Goods once sold cannot be taken back.\n2. Interest @18% per annum will be charged if delayed.",
  invoiceGreet: "Thank you for your business!",
  upiVpa: "msenterprises@sbi",
  logoUrl: "",
  signUrl: "",
  qrUrl: ""
};

export default function CompanySettingsView({ settings, onSaveSettings }: CompanySettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"info" | "logos" | "bank" | "footer" | "upi">("info");
  
  // Settings state initialized with database or default values
  const currentSettings = settings || DEFAULT_SETTINGS;

  const [formState, setFormState] = useState<CompanySettings>({ ...currentSettings });
  const [isSaving, setIsSaving] = useState(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleImageUpload = (id: "logoUrl" | "signUrl" | "qrUrl") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File too large! Max file size allowed is 2MB.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormState(prev => ({
            ...prev,
            [id]: event.target!.result as string
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to clear your current edit buffer and reset back to defaults?")) {
      setFormState({ ...DEFAULT_SETTINGS });
      alert("Buffer reverted to defaults! Don't forget to save.");
    }
  };

  const handleSave = async () => {
    if (!formState.compName.trim()) {
      alert("Error: Company Name is a mandatory field!");
      return;
    }

    try {
      setIsSaving(true);
      await onSaveSettings(formState);
      alert("Success: Company settings securely saved to your real-time cloud database!");
    } catch (err: any) {
      console.error(err);
      alert("Error saving settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none">
      {/* View Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Company Settings</h2>
          <p className="text-xs text-gray-500 mt-1">Manage company parameters, bank details, invoices, footer notes and dynamic pay QR.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#0b4ebd] hover:bg-[#073b99] text-white font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#0b4ebd]/25"
          >
            <Check size={14} />
            <span>{isSaving ? "Saving Settings..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Tabs Menu Panel */}
      <div className="flex gap-2 border-b border-gray-200 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "info"
              ? "border-[#0b4ebd] text-[#0b4ebd] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <Building size={14} />
          <span>Company Information</span>
        </button>

        <button
          onClick={() => setActiveTab("logos")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "logos"
              ? "border-[#0b4ebd] text-[#0b4ebd] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <ImageIcon size={14} />
          <span>Logo & Signature</span>
        </button>

        <button
          onClick={() => setActiveTab("bank")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "bank"
              ? "border-[#0b4ebd] text-[#0b4ebd] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <Building2 size={14} />
          <span>Bank Details</span>
        </button>

        <button
          onClick={() => setActiveTab("footer")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "footer"
              ? "border-[#0b4ebd] text-[#0b4ebd] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <FileText size={14} />
          <span>Invoice Footer</span>
        </button>

        <button
          onClick={() => setActiveTab("upi")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "upi"
              ? "border-[#0b4ebd] text-[#0b4ebd] font-bold"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          <QrCode size={14} />
          <span>UPI QR Code</span>
        </button>
      </div>

      {/* Main Form Fields depending on Active Tab */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm min-h-[350px]">
        {/* Tab 1: Company Info */}
        {activeTab === "info" && (
          <div className="space-y-5 max-w-4xl animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Company Name *</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    id="compName"
                    value={formState.compName}
                    onChange={handleTextChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/5 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    id="compWeb"
                    value={formState.compWeb}
                    onChange={handleTextChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/5 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">Address *</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-4 text-gray-400" size={14} />
                <textarea
                  id="compAddr"
                  rows={3}
                  value={formState.compAddr}
                  onChange={handleTextChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/5 transition-all resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">State</label>
                <select
                  id="compState"
                  value={formState.compState}
                  onChange={handleTextChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all cursor-pointer"
                >
                  <option>Uttar Pradesh</option>
                  <option>Delhi</option>
                  <option>Punjab</option>
                  <option>Maharashtra</option>
                  <option>Karnataka</option>
                  <option>Haryana</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">City</label>
                <input
                  type="text"
                  id="compCity"
                  value={formState.compCity}
                  onChange={handleTextChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">GST Number</label>
                <input
                  type="text"
                  id="compGst"
                  value={formState.compGst}
                  onChange={handleTextChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Pin Code</label>
                <input
                  type="text"
                  id="compPin"
                  value={formState.compPin}
                  onChange={handleTextChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    id="compPhone"
                    value={formState.compPhone}
                    onChange={handleTextChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Country</label>
                <select
                  id="compCountry"
                  value={formState.compCountry}
                  onChange={handleTextChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all cursor-pointer"
                >
                  <option>India</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Canada</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="email"
                    id="compEmail"
                    value={formState.compEmail}
                    onChange={handleTextChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Billing Currency</label>
                <select
                  id="compCurr"
                  value={formState.compCurr}
                  onChange={handleTextChange}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all cursor-pointer"
                >
                  <option>INR - Indian Rupee (₹)</option>
                  <option>USD - US Dollar ($)</option>
                  <option>EUR - Euro (€)</option>
                  <option>GBP - British Pound (£)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Logo & Digital Signatures */}
        {activeTab === "logos" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl animate-fadeIn">
            {/* Box 1: Logo */}
            <div className="p-5 border border-gray-150 rounded-2xl flex flex-col gap-4">
              <div>
                <h4 className="text-sm font-bold text-gray-800">Company Logo</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Maximum file size 2MB. Format: PNG, JPG.</p>
              </div>

              <div className="h-40 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center p-3 relative overflow-hidden group">
                {formState.logoUrl ? (
                  <>
                    <img src={formState.logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, logoUrl: "" }))}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-lg p-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">No Logo Loaded</span>
                )}
              </div>

              <label className="w-full text-center py-2.5 border border-dashed border-[#0b4ebd] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#0b4ebd] text-xs font-semibold rounded-xl cursor-pointer transition-colors block">
                Browse Files
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload("logoUrl")}
                  className="hidden"
                />
              </label>
            </div>

            {/* Box 2: Digital Sign */}
            <div className="p-5 border border-gray-150 rounded-2xl flex flex-col gap-4">
              <div>
                <h4 className="text-sm font-bold text-gray-800">Digital Signature</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Transparent background PNG format is recommended.</p>
              </div>

              <div className="h-40 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center p-3 relative overflow-hidden group">
                {formState.signUrl ? (
                  <>
                    <img src={formState.signUrl} alt="Signature preview" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, signUrl: "" }))}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-lg p-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">No Signature Loaded</span>
                )}
              </div>

              <label className="w-full text-center py-2.5 border border-dashed border-[#0b4ebd] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#0b4ebd] text-xs font-semibold rounded-xl cursor-pointer transition-colors block">
                Browse Files
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload("signUrl")}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Tab 3: Bank Details */}
        {activeTab === "bank" && (
          <div className="space-y-5 max-w-3xl animate-fadeIn">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">Bank Name</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  id="bankName"
                  value={formState.bankName}
                  onChange={handleTextChange}
                  placeholder="e.g. State Bank of India"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Account Holder Name</label>
                <input
                  type="text"
                  id="bankHolder"
                  value={formState.bankHolder}
                  onChange={handleTextChange}
                  placeholder="e.g. MS Enterprises"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Account Number</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    id="bankAccNo"
                    value={formState.bankAccNo}
                    onChange={handleTextChange}
                    placeholder="e.g. 302100054321"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">IFSC Code</label>
                <input
                  type="text"
                  id="bankIfsc"
                  value={formState.bankIfsc}
                  onChange={handleTextChange}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all font-mono uppercase"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400">Branch Name</label>
                <input
                  type="text"
                  id="bankBranch"
                  value={formState.bankBranch}
                  onChange={handleTextChange}
                  placeholder="e.g. Civil Lines Area"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Invoice Footer */}
        {activeTab === "footer" && (
          <div className="space-y-5 max-w-3xl animate-fadeIn">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">Terms & Conditions (Prints at bottom corner of bills)</label>
              <textarea
                id="invoiceTerms"
                rows={4}
                value={formState.invoiceTerms}
                onChange={handleTextChange}
                placeholder="1. Goods once sold..."
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] focus:ring-2 focus:ring-[#0b4ebd]/5 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">Custom Greetings / Thank You Message</label>
              <div className="relative">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-pulse" size={14} />
                <input
                  type="text"
                  id="invoiceGreet"
                  value={formState.invoiceGreet}
                  onChange={handleTextChange}
                  placeholder="Thank you for your business!"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: UPI Pay QR Code */}
        {activeTab === "upi" && (
          <div className="space-y-6 max-w-3xl animate-fadeIn">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400">UPI Merchant ID / Virtual Payment Address (VPA)</label>
              <div className="relative">
                <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  id="upiVpa"
                  value={formState.upiVpa}
                  onChange={handleTextChange}
                  placeholder="e.g. msenterprises@sbi"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0b4ebd] transition-all"
                />
              </div>
            </div>

            <div className="p-5 border border-gray-150 rounded-2xl flex flex-col gap-4 max-w-md">
              <div>
                <h4 className="text-sm font-bold text-gray-800">Scan-to-Pay UPI QR Code Image</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Drop or browse QR image to print on invoices.</p>
              </div>

              <div className="h-48 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center p-3 relative overflow-hidden group">
                {formState.qrUrl ? (
                  <>
                    <img src={formState.qrUrl} alt="UPI QR preview" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, qrUrl: "" }))}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-lg p-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <div className="text-center flex flex-col items-center gap-2">
                    <QrCode size={28} className="text-gray-300" />
                    <span className="text-[10px] text-gray-400 font-semibold leading-none">No QR Loaded</span>
                  </div>
                )}
              </div>

              <label className="w-full text-center py-2.5 border border-dashed border-[#0b4ebd] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#0b4ebd] text-xs font-semibold rounded-xl cursor-pointer transition-colors block">
                Browse QR Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload("qrUrl")}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
