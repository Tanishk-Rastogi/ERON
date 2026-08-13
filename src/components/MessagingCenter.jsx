import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  CheckCheck, 
  Check, 
  Search, 
  Filter, 
  Zap, 
  Paperclip, 
  FileText, 
  Clock, 
  User, 
  AlertTriangle,
  Radio,
  Building2,
  Ambulance,
  Lock
} from 'lucide-react';

export function MessagingCenter({ activeRole, onOpenPacketModal }) {
  const { 
    threads, 
    messages, 
    typingUsers, 
    sendChatMessage, 
    sendTypingIndicator, 
    markMessagesRead 
  } = useWebSocket();

  const [selectedThreadId, setSelectedThreadId] = useState('thread-ref-1001');
  const [activeThreadTab, setActiveThreadTab] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const currentThread = threads.find(t => t.id === selectedThreadId) || threads[0];
  const activeThreadMessages = messages.filter(m => m.threadId === (currentThread?.id || 'thread-ref-1001'));

  // Mark thread messages as read when opening thread
  useEffect(() => {
    if (currentThread?.id && activeRole?.id) {
      markMessagesRead(currentThread.id, activeRole.id);
    }
  }, [currentThread?.id, activeRole?.id]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadMessages.length]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator(selectedThreadId, true, activeRole);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingIndicator(selectedThreadId, false, activeRole);
    }, 1500);
  };

  const handleSendMessage = async (overrideText = null, messageType = 'REGULAR', hasPacket = false) => {
    const textToSend = (overrideText || inputText).trim();
    if (!textToSend) return;

    const msgPayload = {
      threadId: currentThread ? currentThread.id : 'thread-ref-1001',
      referralId: currentThread?.referralId || 'ref-1001',
      senderId: activeRole?.id || 'user-staff-1',
      senderName: activeRole?.name || 'Duty Staff',
      senderRole: activeRole?.roleDesk || 'Duty Nurse',
      senderHospitalId: activeRole?.hospitalId || 'hosp-a',
      text: textToSend,
      priority: currentThread?.priority || 'URGENT',
      messageType,
      attachmentPacketId: hasPacket ? 'pkt-1' : null
    };

    await sendChatMessage(msgPayload);
    if (!overrideText) setInputText('');
    setIsTyping(false);
    sendTypingIndicator(selectedThreadId, false, activeRole);
  };

  // Filter threads
  const filteredThreads = threads.filter(t => {
    if (activeThreadTab === 'REFERRAL' && t.type !== 'REFERRAL_CHANNEL') return false;
    if (activeThreadTab === 'DIRECT' && t.type !== 'HOSPITAL_DIRECT') return false;
    if (activeThreadTab === 'BROADCAST' && t.type !== 'CONTROL_BROADCAST') return false;

    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (t.title || '').toLowerCase().includes(q);
      const codeMatch = (t.patientRefCode || '').toLowerCase().includes(q);
      if (!titleMatch && !codeMatch) return false;
    }

    return true;
  });

  // Emergency 1-tap template presets
  const quickTemplates = [
    { label: '🚨 Request ICU Bed & Neurosurgery', text: 'CRITICAL: Patient requires immediate ICU bed + Neurosurgery setup. GCS 8/15.', type: 'REFERRAL_REQUEST', hasPacket: true },
    { label: '✓ Accept Bed & Confirm Reservation', text: 'BED RESERVED: Bed Desk confirmed ICU bed reservation. Bed hold active for 15 mins.', type: 'BED_HOLD_CONFIRMED', hasPacket: false },
    { label: '⚡ Reroute Alert - Capacity Lost', text: 'RE-ROUTING ALERT: Destination hospital lost capacity mid-transit. Reroute recalculating.', type: 'REROUTE_ALERT', hasPacket: false },
    { label: '🚑 Ambulance En-Route (ETA 14m)', text: 'DISPATCH UPDATE: ALS Ambulance AMB-101 en-route. Driver Suresh Kumar (ETA 14 min).', type: 'DISPATCH_UPDATE', hasPacket: false }
  ];

  return (
    <div className="eleven-card p-6 bg-white border-[#e7e5e4] space-y-4 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0efed] pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#292524]" />
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-[#0c0a09]">
            Real-Time Messaging & Clinical Channel Center
          </h2>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#777169]">
          <span className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            WebSocket Live Sync
          </span>
        </div>
      </div>

      {/* Main Grid: Thread List (Left 4 cols) + Chat View (Right 8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[520px]">
        {/* Left Column: Threads Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-3 border-r border-[#f0efed] pr-0 lg:pr-4">
          {/* Thread Type Tabs */}
          <div className="flex gap-1 bg-[#f5f5f5] p-1 rounded-xl text-[11px] font-mono font-bold">
            {['ALL', 'REFERRAL', 'DIRECT', 'BROADCAST'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveThreadTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeThreadTab === tab 
                    ? 'bg-[#292524] text-white shadow-xs' 
                    : 'text-[#777169] hover:text-[#0c0a09]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search & Priority Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search patient ref or hospital..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#292524] font-mono focus:outline-none focus:border-[#292524]"
              />
              <Search className="w-3.5 h-3.5 text-[#777169] absolute left-2.5 top-2.5" />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl px-2 py-1.5 text-[11px] font-mono font-bold text-[#292524] focus:outline-none"
            >
              <option value="ALL">All Priority</option>
              <option value="CRITICAL">Critical</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Thread Cards List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#777169] font-mono">
                No threads matching filters.
              </div>
            ) : (
              filteredThreads.map(t => {
                const isSelected = selectedThreadId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all space-y-1 ${
                      isSelected 
                        ? 'bg-[#292524] text-white border-[#292524] shadow-sm' 
                        : 'bg-[#fafafa] text-[#292524] border-[#e7e5e4] hover:bg-[#f0efed]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                        t.priority === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {t.priority}
                      </span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-[#a8a29e]' : 'text-[#777169]'}`}>
                        {new Date(t.lastMessageAt || t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="font-bold truncate">{t.title}</h4>
                    <p className={`text-[11px] truncate ${isSelected ? 'text-[#d6d3d1]' : 'text-[#777169]'}`}>
                      {t.lastMessageText}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Conversation View (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
          {/* Active Thread Bar */}
          <div className="flex items-center justify-between bg-[#fafafa] p-3 rounded-2xl border border-[#e7e5e4]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#0c0a09] font-mono">
                  {currentThread?.title || 'Referral Channel'}
                </h3>
                {currentThread?.patientRefCode && (
                  <span className="font-mono text-[10px] bg-[#f0efed] px-2 py-0.5 rounded-full text-[#292524] border border-[#e7e5e4]">
                    #{currentThread.patientRefCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#777169]">
                Active Sender: <strong className="text-[#0c0a09]">{activeRole?.name || 'Staff'}</strong> ({activeRole?.roleDesk || 'Duty Nurse'})
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] bg-[#a7e5d3]/40 text-[#0c0a09] border border-[#a7e5d3] font-mono px-2 py-0.5 rounded-full font-bold">
                REAL-TIME CHANNEL
              </span>
            </div>
          </div>

          {/* Messages History Feed */}
          <div className="flex-1 space-y-3 max-h-[340px] overflow-y-auto p-3 bg-[#fdfdfd] rounded-2xl border border-[#f0efed]">
            {activeThreadMessages.map(msg => {
              const isMine = msg.senderId === activeRole?.id;

              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col space-y-1 ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 text-[10px] text-[#777169] font-mono">
                    <span className="font-bold text-[#292524]">{msg.senderName} ({msg.senderRole})</span>
                    <span>• {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className={`p-3.5 rounded-2xl max-w-[85%] text-xs space-y-2 border shadow-xs ${
                    isMine 
                      ? 'bg-[#292524] text-white border-[#292524]' 
                      : 'bg-white text-[#292524] border-[#e7e5e4]'
                  }`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                    {/* Clinical Packet Attachment Card */}
                    {msg.hasAttachment && (
                      <div className={`p-2.5 rounded-xl border text-[11px] font-mono flex items-center justify-between gap-3 ${
                        isMine ? 'bg-[#3b3531] border-[#524b45] text-white' : 'bg-[#fafafa] border-[#e7e5e4] text-[#0c0a09]'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <div className="truncate">
                            <span className="font-bold block">Encrypted Clinical Handoff Packet</span>
                            <span className="text-[9px] text-[#a8a29e]">AES-256 GCS 8/15 Payload</span>
                          </div>
                        </div>

                        <button
                          onClick={() => onOpenPacketModal(msg.attachmentPacketId || 'pkt-1')}
                          className="eleven-button eleven-button-primary text-[10px] py-1 px-2.5 flex-shrink-0"
                        >
                          Decrypt Packet
                        </button>
                      </div>
                    )}

                    {/* Message Read Status Indicators */}
                    <div className={`flex items-center justify-end gap-1 text-[10px] font-mono ${
                      isMine ? 'text-slate-300' : 'text-[#777169]'
                    }`}>
                      {msg.status === 'READ' ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <CheckCheck className="w-3.5 h-3.5" /> READ
                        </span>
                      ) : msg.status === 'DELIVERED' ? (
                        <span className="flex items-center gap-1 text-blue-400">
                          <CheckCheck className="w-3.5 h-3.5" /> DELIVERED
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> SENT
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {typingUsers[selectedThreadId] && (
              <div className="flex items-center gap-2 text-xs text-amber-600 font-mono italic animate-pulse">
                <span>{typingUsers[selectedThreadId].userName} is typing message...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 5. Emergency Quick Actions Templates */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold text-[#777169] uppercase tracking-wider block">
              1-TAP EMERGENCY TEMPLATE ACTIONS (BACKEND CONNECTED):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickTemplates.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(tmpl.text, tmpl.type, tmpl.hasPacket)}
                  className="px-2.5 py-1 rounded-xl border border-[#e7e5e4] bg-[#fafafa] hover:bg-[#292524] hover:text-white text-[11px] font-mono transition-all text-[#292524]"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input & Send Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
            <input
              type="text"
              placeholder={`Send message as ${activeRole?.roleDesk || 'Staff'}...`}
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 bg-[#fafafa] border border-[#e7e5e4] rounded-2xl px-4 py-2.5 text-xs text-[#292524] focus:outline-none focus:border-[#292524] focus:bg-white"
            />

            <button
              type="submit"
              className="eleven-button eleven-button-primary text-xs px-4 py-2.5 flex items-center gap-2"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
