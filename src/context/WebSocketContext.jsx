import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { apiClient } from '../utils/apiClient.js';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { threadId: { userName, userRole } }
  const [lastNotification, setLastNotification] = useState(null);
  const [lastAcceptedReferral, setLastAcceptedReferral] = useState(null);
  const [lastRejectedReferral, setLastRejectedReferral] = useState(null);
  const wsRef = useRef(null);

  const fetchInitialData = async () => {
    try {
      const [hospRes, refRes, threadsRes, msgRes] = await Promise.all([
        apiClient('/api/hospitals'),
        apiClient('/api/referrals'),
        apiClient('/api/threads'),
        apiClient('/api/messages')
      ]);

      if (hospRes.ok) setHospitals(await hospRes.json());
      if (refRes.ok) {
        const refs = await refRes.json();
        // Preserve originalTargetHospitalId on all fetched referrals
        setReferrals(refs.map(r => ({ ...r, originalTargetHospitalId: r.originalTargetHospitalId || r.targetHospitalId })));
      }
      if (threadsRes.ok) setThreads(await threadsRes.json());
      if (msgRes.ok) setMessages(await msgRes.json());
    } catch (err) {
      console.error('API initial fetch error:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Setup WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connectWs = () => {
      let ws;
      const authData = JSON.parse(localStorage.getItem('eron_auth_session') || '{}');
      const token = authData.token || '';
      const qs = token ? `?token=${token}` : '';
      try {
        ws = new WebSocket(wsUrl + qs);
      } catch (e) {
        ws = new WebSocket(`${protocol}//${window.location.hostname}:3001/ws` + qs);
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('[WS] Connected to ERON Real-time Engine');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'INIT_STATE') {
            if (msg.hospitals) setHospitals(msg.hospitals);
            if (msg.referrals) setReferrals(msg.referrals);
          } else if (msg.type === 'CAPACITY_UPDATED') {
            setHospitals(prev => prev.map(h => {
              if (String(h.id) === String(msg.hospitalId)) {
                const updatedRes = h.resources.map(r => 
                  (String(r.resourceType) === String(msg.resourceType) || String(r.type) === String(msg.resourceType) || String(r.bed_type) === String(msg.resourceType))
                    ? { ...r, availableCount: msg.availableCount, available: msg.availableCount, updatedAt: msg.updatedAt, last_updated_at: msg.updatedAt }
                    : r
                );
                return { ...h, resources: updatedRes, lastCapacityUpdateAt: msg.updatedAt };
              }
              return h;
            }));
          } else if (['REFERRAL_CREATED', 'REFERRAL_ACCEPTED', 'AMBULANCE_DISPATCHED', 'REFERRAL_COMPLETED', 'REFERRAL_REJECTED', 'REFERRAL_UPDATED'].includes(msg.type)) {
            setReferrals(prev => {
              if (!msg.referral) return prev;
              const incoming = msg.referral;
              const exists = prev.some(r => r.id === incoming.id);
              if (exists) {
                return prev.map(r => {
                  if (r.id !== incoming.id) return r;
                  // Merge: keep existing field values if incoming field is null/undefined
                  // This ensures originHospitalId/Name etc. are never wiped by a partial update
                  const merged = { ...r };
                  Object.entries(incoming).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) merged[k] = v;
                    else if (k === 'status' || k === 'rejectionReason') merged[k] = v; // allow null status clears
                  });
                  return merged;
                });
              }
              // On first creation, preserve the original target so reroutes don't lose it
              if (incoming.targetHospitalId) {
                incoming.originalTargetHospitalId = incoming.originalTargetHospitalId || incoming.targetHospitalId;
              }
              return [incoming, ...prev];
            });
            // Surface accepted / rejected events for App-level CTA toasts
            if (msg.type === 'REFERRAL_ACCEPTED' && msg.referral) {
              setLastAcceptedReferral({ ...msg.referral, acceptedByName: msg.acceptedByName });
            }
            if (msg.type === 'REFERRAL_REJECTED' && msg.referral) {
              setLastRejectedReferral({ ...msg.referral, rejectionReason: msg.rejectionReason, rejectedByName: msg.rejectedByName });
            }
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: msg.type === 'REFERRAL_REJECTED' ? 'error' : 'info' });
          } else if (msg.type === 'REFERRAL_REROUTING') {
            setReferrals(prev => prev.map(r => r.id === msg.referralId ? msg.referral : r));
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'warning' });
          } else if (msg.type === 'REFERRAL_REROUTED') {
            setReferrals(prev => prev.map(r => {
              if (r.id !== msg.referralId) return r;
              // Preserve originalTargetHospitalId across reroutes
              const original = r.originalTargetHospitalId || r.targetHospitalId;
              return { ...msg.referral, originalTargetHospitalId: original };
            }));
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'success' });
          } else if (msg.type === 'REFERRAL_ESCALATED') {
            setReferrals(prev => prev.map(r => r.id === msg.referralId ? msg.referral : r));
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'error' });
          } else if (msg.type === 'CHAT_MESSAGE_RECEIVED') {
            setMessages(prev => {
              const exists = prev.some(m => m.id === msg.message.id);
              return exists ? prev : [...prev, msg.message];
            });

            // Update thread lastMessage
            setThreads(prev => prev.map(t => {
              if (t.id === msg.threadId) {
                return {
                  ...t,
                  lastMessageText: msg.message.text,
                  lastMessageAt: msg.message.createdAt
                };
              }
              return t;
            }));
          } else if (msg.type === 'TYPING_INDICATOR') {
            setTypingUsers(prev => ({
              ...prev,
              [msg.threadId]: msg.isTyping ? { userName: msg.userName, userRole: msg.userRole } : null
            }));
          } else if (msg.type === 'MESSAGES_READ') {
            setMessages(prev => prev.map(m => m.threadId === msg.threadId ? { ...m, status: 'READ' } : m));
          }
        } catch (err) {
          console.error('[WS Parse Error]:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connectWs, 3000);
      };

      ws.onerror = (err) => {
        setIsConnected(false);
        ws.close();
      };
    };

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const refreshAll = () => {
    fetchInitialData();
  };

  const sendChatMessage = async (msgData) => {
    try {
      const res = await apiClient('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgData)
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMsg.id);
          return exists ? prev : [...prev, newMsg];
        });
        return newMsg;
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  const sendTypingIndicator = (threadId, isTyping, userSession) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TYPING_INDICATOR',
        threadId,
        isTyping,
        userId: userSession?.userId || 'user-current',
        userName: userSession?.userName || userSession?.hospitalName || 'Duty Staff',
        userRole: userSession?.roleDesk || 'Staff'
      }));
    }
  };

  const markMessagesRead = async (threadId, userId) => {
    try {
      await apiClient('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, userId })
      });
      setMessages(prev => prev.map(m => m.threadId === threadId ? { ...m, status: 'READ' } : m));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      hospitals,
      referrals,
      threads,
      messages,
      typingUsers,
      lastNotification,
      setLastNotification,
      lastAcceptedReferral,
      setLastAcceptedReferral,
      lastRejectedReferral,
      setLastRejectedReferral,
      refreshAll,
      sendChatMessage,
      sendTypingIndicator,
      markMessagesRead
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}

