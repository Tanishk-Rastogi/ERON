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
      if (refRes.ok) setReferrals(await refRes.json());
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
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        ws = new WebSocket(`${protocol}//${window.location.hostname}:3001`);
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
              if (h.id === msg.hospitalId) {
                const updatedRes = h.resources.map(r => 
                  r.resourceType === msg.resourceType 
                    ? { ...r, availableCount: msg.availableCount, updatedAt: msg.updatedAt }
                    : r
                );
                return { ...h, resources: updatedRes, lastCapacityUpdateAt: msg.updatedAt };
              }
              return h;
            }));
          } else if (['REFERRAL_CREATED', 'REFERRAL_ACCEPTED', 'AMBULANCE_DISPATCHED', 'REFERRAL_COMPLETED'].includes(msg.type)) {
            setReferrals(prev => {
              const exists = prev.some(r => r.id === msg.referral.id);
              return exists 
                ? prev.map(r => r.id === msg.referral.id ? msg.referral : r)
                : [msg.referral, ...prev];
            });
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'info' });
          } else if (msg.type === 'REFERRAL_REROUTING') {
            setReferrals(prev => prev.map(r => r.id === msg.referralId ? msg.referral : r));
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'warning' });
          } else if (msg.type === 'REFERRAL_REROUTED') {
            setReferrals(prev => prev.map(r => r.id === msg.referralId ? msg.referral : r));
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

