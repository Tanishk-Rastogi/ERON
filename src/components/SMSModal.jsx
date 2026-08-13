import React, { useState } from 'react';
import { apiClient } from '../utils/apiClient.js';
import { MessageSquareText, Send, X, CheckCircle2 } from 'lucide-react';

export function SMSModal({ isOpen, onClose }) {
  const [phone, setPhone] = useState('+91-98765-43210');
  const [smsText, setSmsText] = useState('CT 500 URGENT');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  if (!isOpen) return null;

  const handleSendSMS = async () => {
    setLoading(true);
    setResponse(null);

    try {
      const res = await apiClient('/api/sms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPhone: phone,
          body: smsText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data);
      }
    } catch (err) {
      console.error('SMS error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="eleven-card w-full max-w-lg p-6 bg-white border-[#d6d3d1] space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-[#292524]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0c0a09] font-mono">
              SMS Short-Code 1923 Fallback Sandbox
            </h2>
          </div>

          <button onClick={onClose} className="text-[#777169] hover:text-[#0c0a09] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="text-[#4e4e4e] font-semibold block mb-1">Staff Phone Number:</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-2.5 font-mono text-[#292524] focus:outline-none focus:border-[#292524]"
            />
          </div>

          <div>
            <label className="text-[#4e4e4e] font-semibold block mb-1">SMS Payload (Short-Code 1923):</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                className="flex-1 bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-2.5 font-mono font-bold uppercase text-[#292524] focus:outline-none focus:border-[#292524]"
              />
              <button
                onClick={handleSendSMS}
                disabled={loading}
                className="eleven-button eleven-button-primary text-xs px-4 py-2.5"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Sending...' : 'Test SMS'}</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Inputs */}
          <div className="flex gap-2 font-mono text-[11px]">
            <button
              onClick={() => setSmsText('CT 500 URGENT')}
              className="px-2.5 py-1 rounded-xl bg-[#f0efed] border border-[#e7e5e4] hover:bg-[#e7e5e4]"
            >
              Preset: CT 500 URGENT
            </button>
            <button
              onClick={() => setSmsText('ICU 500 CRITICAL')}
              className="px-2.5 py-1 rounded-xl bg-[#f0efed] border border-[#e7e5e4] hover:bg-[#e7e5e4]"
            >
              Preset: ICU 500 CRITICAL
            </button>
          </div>

          {/* Response Box */}
          {response && (
            <div className="p-4 bg-[#fafafa] border border-[#a7e5d3] rounded-2xl space-y-2 font-mono">
              <div className="flex items-center justify-between text-[#16a34a] font-bold text-[11px]">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  SMS Parsed & Response Sent via MSG91 Gateway
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#e7e5e4] text-sm text-[#0c0a09] font-bold">
                "{response.replyText}"
              </div>

              <div className="text-[10px] text-[#777169]">
                Raw Input: <strong>{response.rawText}</strong> | Top Candidates Matched: {response.matches?.length || 0}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

