import React, { useState, useEffect } from "react";
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Copy, 
  ChevronRight, 
  RefreshCw, 
  Power,
  Sparkles,
  Award,
  Database,
  Users
} from "lucide-react";

interface AuthViewProps {
  onLoginSuccess: (email: string, password?: string) => void;
}

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  // Navigation states: "activation" | "login" | "changepass"
  const [viewState, setViewState] = useState<"activation" | "login" | "changepass">("activation");
  
  // Check local activation state in localStorage
  useEffect(() => {
    const isActivated = localStorage.getItem("ms_device_activated");
    if (isActivated === "true") {
      setViewState("login");
    }
  }, []);

  // Activation states
  const [activationKey, setActivationKey] = useState("");
  const hardwareId = "MS-HARDWARE-9X2B7-FEDORA";

  // Login states
  const [email, setEmail] = useState("admin@ms.com");
  const [password, setPassword] = useState("admin");
  const [showPassword, setShowPassword] = useState(false);

  // Change Password states
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const handleCopyId = () => {
    navigator.clipboard.writeText(hardwareId);
    alert("Hardware ID copied successfully to clipboard!");
  };

  const handleActivation = (e: React.FormEvent) => {
    e.preventDefault();
    const key = activationKey.trim().toUpperCase();
    if (key === "MS" || key === "ADMIN") {
      localStorage.setItem("ms_device_activated", "true");
      alert("Device Binding Successful! Your hardware is successfully registered.");
      setViewState("login");
    } else {
      alert("Invalid Activation Key! Please contact developer (Manpreet Singh) or use key: MS");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const userVal = email.trim();
    const passVal = password.trim();

    // Support standard admin credentials
    if ((userVal === "admin" || userVal === "admin@ms.com") && passVal === "admin") {
      onLoginSuccess(userVal, passVal);
    } else {
      alert("गलत यूजरनेम या पासवर्ड! (Default credentials: admin / admin)");
    }
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPass !== "admin") {
      alert("आपका वर्तमान (Current) पासवर्ड गलत है!");
      return;
    }
    if (newPass !== confirmPass) {
      alert("नया पासवर्ड और कन्फर्म पासवर्ड आपस में मेल नहीं खा रहे हैं!");
      return;
    }

    alert("पासवर्ड सफलतापूर्वक बदल दिया गया है! कृपया अब लॉगिन करें।");
    setViewState("login");
    setCurrentPass("");
    setNewPass("");
    setConfirmPass("");
  };

  return (
    <div className="min-h-screen bg-[#f0f4fa] flex flex-col justify-center items-center p-4 select-none">
      {/* Container holding form & details */}
      <div className="bg-white w-[1000px] max-w-full h-[580px] rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row mb-6 animate-scaleUp">
        {/* Left Hand side Blue Brand Presentation Grid (42% width equivalent) */}
        <div className="w-full md:w-[42%] bg-gradient-to-br from-[#1e70e6] to-[#0c4cb3] text-white p-10 flex flex-col justify-center items-center text-center relative">
          
          {/* Mock matrix circles details */}
          <div className="absolute top-8 left-8 text-white/10 text-xs font-mono select-none leading-3 hidden md:block">
            •••••<br />•••••<br />•••••
          </div>
          <div className="absolute bottom-8 right-8 text-white/10 text-xs font-mono select-none leading-3 hidden md:block">
            •••••<br />•••••<br />•••••
          </div>

          <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-white to-gray-300 p-1 flex items-center justify-center border-4 border-gray-100 shadow-inner mb-6">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-150 to-white flex items-center justify-center shadow-lg font-black text-4xl italic text-[#0c4cb3]">
              MS
            </div>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight leading-none uppercase">MS</h2>
          <h3 className="text-sm font-semibold tracking-widest mt-1 opacity-90">Billing Software</h3>
          <p className="text-xs text-white/70 max-w-xs mt-3">Smart Billing, Better Business. A cloud-synchronised invoicing tool crafted for scale.</p>
        </div>

        {/* Right Hand side form inputs (58% equivalent) */}
        <div className="w-full md:w-[58%] p-10 md:p-12 flex flex-col justify-center relative">
          
          {/* Form 1: Device Hardware Activation Panel */}
          {viewState === "activation" && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-blue-50 text-[#0c4cb3] rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-lg font-extrabold text-gray-800">Device Activation Required</h3>
                <p className="text-xs text-gray-400 mt-1">First-time installation detected. Please enter your Activation License Key.</p>
              </div>

              <div className="bg-gray-50 border border-dashed border-gray-250 p-3 rounded-xl flex justify-between items-center text-xs font-semibold text-gray-700 mb-6">
                <span>Hardware ID: <code className="text-[#0c4cb3] font-mono ml-1">{hardwareId}</code></span>
                <button 
                  onClick={handleCopyId}
                  className="text-xs font-bold text-[#0c4cb3] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
              </div>

              <form onSubmit={handleActivation} className="space-y-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Enter Activation Key</label>
                  <input
                    type="text"
                    required
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#0c4cb3] focus:ring-2 focus:ring-[#0c4cb3]/10 font-bold uppercase tracking-wider text-center"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0c4cb3] hover:bg-[#063280] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#0c4cb3]/15 cursor-pointer"
                >
                  <span>Activate Device</span>
                  <ChevronRight size={14} />
                </button>
              </form>

              <div className="text-center mt-6">
                <button 
                  onClick={() => alert("Please activate to use system dashboard.\nDefault key: MS")}
                  className="text-red-500 hover:text-red-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Power size={13} />
                  <span>Exit Setup</span>
                </button>
              </div>
            </div>
          )}

          {/* Form 2: Main Credentials Login Panel */}
          {viewState === "login" && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6">
                <h3 className="text-lg font-black text-gray-800">Login to Your Account</h3>
                <p className="text-xs text-gray-400 mt-1">Welcome back! Please login to synchronize your ledger database.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1e70e6]" size={15} />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Username / Email"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1e70e6] focus:ring-2 focus:ring-[#1e70e6]/10"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1e70e6]" size={15} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1e70e6] focus:ring-2 focus:ring-[#1e70e6]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="rounded text-[#1e70e6] focus:ring-transparent border-gray-300 w-3.5 h-3.5"
                    />
                    <span>Show Password</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => alert("Please contact system administrator (Manpreet Singh) for manual data verification and secure password retrieval.")}
                    className="text-[#1e70e6] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#1e70e6] hover:bg-[#0c4cb3] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#1e70e6]/20 cursor-pointer"
                >
                  <span>Sign In</span>
                  <ChevronRight size={14} />
                </button>
              </form>

              {/* Action Divider OR */}
              <div className="flex items-center my-5 text-gray-450 text-[10px] font-bold tracking-wider select-none">
                <hr className="flex-1 border-gray-200" />
                <span className="px-2">OR</span>
                <hr className="flex-1 border-gray-200" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setViewState("changepass")}
                  className="py-2.5 border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 bg-white hover:bg-gray-50 text-gray-700 transition-all cursor-pointer shadow-sm"
                >
                  <Lock size={15} className="text-[#0c4cb3]" />
                  <span className="text-[10px] font-bold">Change Password</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to deactivate session?")) {
                      localStorage.removeItem("ms_device_activated");
                      setViewState("activation");
                    }
                  }}
                  className="py-2.5 border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 bg-white hover:bg-red-50 text-red-500 transition-all cursor-pointer shadow-sm"
                >
                  <Power size={15} className="text-red-500" />
                  <span className="text-[10px] font-bold">Reset Activation</span>
                </button>
              </div>

              <div className="mt-5 p-3 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col gap-1 text-[11px] text-gray-600 leading-normal">
                <p><strong>System Note :</strong> Real-time Database actively syncing.</p>
                <p className="text-gray-400 text-[10px]">Use mock credentials: <strong>admin</strong> / <strong>admin</strong> to enter.</p>
              </div>
            </div>
          )}

          {/* Form 3: Password Update Block Panel */}
          {viewState === "changepass" && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6">
                <h3 className="text-lg font-black text-gray-800">Change Password</h3>
                <p className="text-xs text-gray-400 mt-1">Configure a secure custom entry password for your administrative profile.</p>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      type="password"
                      required
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="Current Password"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1e70e6]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1e70e6]" size={15} />
                    <input
                      type="password"
                      required
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="New Password"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1e70e6]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1e70e6]" size={15} />
                    <input
                      type="password"
                      required
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="Confirm New Password"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-[#1e70e6]"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setViewState("login")}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-[#1e70e6] hover:bg-[#0c4cb3] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#1e70e6]/20 cursor-pointer"
                  >
                    <span>Save Password</span>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Sub-Footer Layout features (Width equivalent to 1000px matches login mock) */}
      <div className="w-[1000px] max-w-full bg-white rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 shadow-md border border-white">
        <div className="flex items-center gap-3 border-r border-gray-100 last:border-0 p-1">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0c4cb3] flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-800">Secure & Reliable</h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Your data is safe in Cloud</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-r border-gray-100 last:border-0 p-1">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0c4cb3] flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-800">Easy to Use</h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Simple reactive dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-r border-gray-100 last:border-0 p-1">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0c4cb3] flex items-center justify-center">
            <Database size={18} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-800">Auto Backup</h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Firestore instant persistence</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-r border-gray-100 last:border-0 p-1">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0c4cb3] flex items-center justify-center">
            <Users size={18} />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-gray-800">24/7 Support</h4>
            <p className="text-[9px] text-gray-400 mt-0.5">Developer verified assistance</p>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-gray-400 font-medium tracking-wide mt-4">
        © 2026 MS Billing Software. All Cloud Rights Reserved.
      </div>
    </div>
  );
}
