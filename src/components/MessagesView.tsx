import React, { useState } from "react";
import { Mail, MessageSquare, Send, CheckCircle2, User, Sparkles } from "lucide-react";

interface Message {
  id: string;
  sender: string;
  senderRole: string;
  avatar: string;
  text: string;
  time: string;
  isSelf: boolean;
}

export default function MessagesView() {
  const [chats, setChats] = useState<{ id: string; name: string; org: string; avatar: string; unread: boolean; lastMsg: string }[]>([
    { id: "1", name: "Amit Sharma", org: "Sharma Logistics", avatar: "AS", unread: true, lastMsg: "Hello! Can you please send the tax sheet for INV-101?" },
    { id: "2", name: "Rajesh Verma", org: "Verma Mobiles", avatar: "RV", unread: false, lastMsg: "Payment of ₹3,400 successfully wired via UPI. Thank you." },
    { id: "3", name: "System Automation", org: "Firestore Engine", avatar: "SA", unread: false, lastMsg: "Auto-backup script completed successfully at 03:00 AM." },
  ]);

  const [activeChatId, setActiveChatId] = useState("1");
  const [inputText, setInputText] = useState("");

  const [messages, setMessages] = useState<Record<string, Message[]>>({
    "1": [
      { id: "m1", sender: "Amit Sharma", senderRole: "Sharma Logistics", avatar: "AS", text: "Hello! Can you please send the tax invoice sheet for INV-101?", time: "Today, 10:24 AM", isSelf: false },
    ],
    "2": [
      { id: "m3", sender: "Rajesh Verma", senderRole: "Verma Mobiles", avatar: "RV", text: "Hi admin, checking if my Optical Mouse delivery has been logged?", time: "Yesterday, 04:10 PM", isSelf: false },
      { id: "m4", sender: "System Administrator", senderRole: "MS Invoicing", avatar: "AD", text: "Yes Rajesh, Invoice INV-2026-102 was processed and closed.", time: "Yesterday, 04:15 PM", isSelf: true },
      { id: "m5", sender: "Rajesh Verma", senderRole: "Verma Mobiles", avatar: "RV", text: "Payment of ₹3,400 successfully wired via UPI. Thank you.", time: "Yesterday, 04:16 PM", isSelf: false },
    ],
    "3": [
      { id: "m6", sender: "Backup Daemon", senderRole: "System BOT", avatar: "🤖", text: "Alert: Daily cloud synchronisation check initiated.", time: "Today, 03:00 AM", isSelf: false },
      { id: "m7", sender: "Backup Daemon", senderRole: "System BOT", avatar: "🤖", text: "Database integrity 100% green. Backup dump uploaded safely.", time: "Today, 03:00 AM", isSelf: false },
    ]
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const chatMsgList = messages[activeChatId] || [];
    const newMsg: Message = {
      id: `m_user_${Date.now()}`,
      sender: "System Administrator",
      senderRole: "MS Invoicing",
      avatar: "AD",
      text: inputText.trim(),
      time: "Just Now",
      isSelf: true
    };

    setMessages(prev => ({
      ...prev,
      [activeChatId]: [...chatMsgList, newMsg]
    }));

    // Update last message in chat sidebar
    setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, lastMsg: inputText.trim(), unread: false } : c));
    setInputText("");

    // Simulate smart automated response with smart delays! This is awesome!
    setTimeout(() => {
      let replyText = "Understood. The team will follow up on this query immediately.";
      if (activeChatId === "1") {
        replyText = "Perfect! I received your automated reply. Please email the PDF directly to sharma@logistics.com when free.";
      } else if (activeChatId === "2") {
        replyText = "Awesome! Thanks for confirming admin. Looking forward to our next business transaction.";
      } else if (activeChatId === "3") {
        replyText = "Automation Bot Alert: Re-indexing finished successfully.";
      }

      const replyMsg: Message = {
        id: `m_bot_${Date.now()}`,
        sender: chats.find(c => c.id === activeChatId)?.name || "Respondent",
        senderRole: chats.find(c => c.id === activeChatId)?.org || "Client",
        avatar: chats.find(c => c.id === activeChatId)?.avatar || "🤖",
        text: replyText,
        time: "Just Now",
        isSelf: false
      };

      setMessages(prev => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), replyMsg]
      }));

      // Update sidebar again
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, lastMsg: replyText } : c));
    }, 1500);
  };

  const selectedChat = chats.find(c => c.id === activeChatId);
  const activeMessages = messages[activeChatId] || [];

  return (
    <div className="flex flex-col gap-6 animate-fadeIn select-none h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Messages Inbox</h2>
          <p className="text-xs text-gray-500 mt-1">Review active communications, verify transaction confirmations, and manage client follow-up replies.</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0c4cb3] flex items-center justify-center font-bold">
          <Mail size={18} />
        </div>
      </div>

      {/* Main chats window splits in Sidebar + Active Room */}
      <div className="flex-1 min-h-0 bg-white border border-gray-150 rounded-2xl shadow-sm flex overflow-hidden">
        
        {/* Left column: Chat Rooms (1/3 width equivalent) */}
        <div className="w-80 border-r border-gray-100 flex flex-col h-full bg-gray-50/20">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Conversations</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {chats.map((c) => {
              const isActive = c.id === activeChatId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveChatId(c.id);
                    setChats(prev => prev.map(ch => ch.id === c.id ? { ...ch, unread: false } : ch));
                  }}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors cursor-pointer ${
                    isActive ? "bg-blue-50/50 border-r-4 border-[#0c4cb3]" : "hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full font-extrabold text-xs flex items-center justify-center shadow-sm ${
                    c.id === "3" ? "bg-indigo-50 text-indigo-600" : "bg-blue-50 text-[#0c4cb3]"
                  }`}>
                    {c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-1">
                      <h4 className="text-xs font-extrabold text-gray-800 truncate">{c.name}</h4>
                      {c.unread && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 animate-ping"></span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 font-semibold truncate leading-none mt-0.5">{c.org}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-1.5">{c.lastMsg}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Active Chat Room Details */}
        <div className="flex-1 flex flex-col h-full">
          {selectedChat ? (
            <>
              {/* Active Room Title */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 text-[#0c4cb3] flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {selectedChat.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 leading-none">{selectedChat.name}</h4>
                    <p className="text-[9px] text-gray-400 mt-1 font-semibold">{selectedChat.org}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-green-600 font-bold bg-green-50 border border-green-100 rounded-lg px-2 py-0.5 flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    <span>Real-time Active</span>
                  </span>
                </div>
              </div>

              {/* Messages Streams List */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50/10">
                {activeMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.isSelf ? "justify-end" : "justify-start"} animate-fadeIn`}
                  >
                    <div className={`max-w-[70%] flex flex-col gap-1 ${msg.isSelf ? "items-end" : "items-start"}`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        msg.isSelf 
                          ? "bg-[#0c4cb3] text-white rounded-tr-none shadow-md shadow-[#0c4cb3]/10" 
                          : "bg-gray-100 text-gray-850 rounded-tl-none border border-gray-150"
                      }`}>
                        <p>{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-gray-400 font-medium px-1 mt-0.5">{msg.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Send Input Box */}
              <form onSubmit={handleSend} className="p-3 border-t border-gray-150 bg-gray-50/50 flex-shrink-0 flex gap-2 items-center">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a response to client..."
                  className="flex-grow pl-4 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-[#0c4cb3] focus:ring-2 focus:ring-[#0c4cb3]/5"
                />
                <button
                  type="submit"
                  className="bg-[#0c4cb3] hover:bg-[#063280] text-white p-2.5 rounded-xl cursor-pointer shadow-md transition-all shadow-[#0c4cb3]/10"
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={48} className="mb-2 opacity-50" />
              <p className="text-xs">Select a channel to begin communicating.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
