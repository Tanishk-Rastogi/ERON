import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [hospitals, setHospitals] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [lastNotification, setLastNotification] = useState(null);
  const wsRef = useRef(null);

  const fetchInitialData = async () => {
    try {
      const [hospRes, refRes] = await Promise.all([
        fetch('/api/hospitals'),
        fetch('/api/referrals')
      ]);
      if (hospRes.ok) {
        const data = await hospRes.json();
        setHospitals(data);
      }
      if (refRes.ok) {
        const data = await refRes.json();
        setReferrals(data);
      }
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
          } else if (msg.type === 'REFERRAL_CREATED' || msg.type === 'REFERRAL_ACCEPTED' || msg.type === 'AMBULANCE_DISPATCHED' || msg.type === 'REFERRAL_COMPLETED') {
            setReferrals(prev => {
              const exists = prev.some(r => r.id === msg.referral.id);
              if (exists) {
                return prev.map(r => r.id === msg.referral.id ? msg.referral : r);
              } else {
                return [msg.referral, ...prev];
              }
            });
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'info' });
          } else if (msg.type === 'REFERRAL_REROUTING') {
            setReferrals(prev => prev.map(r => r.id === msg.referralId ? msg.referral : r));
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'warning' });
          } else if (msg.type === 'REFERRAL_REROUTED') {
            setReferrals(prev => prev.map(r => r.id === msg.referralId ? msg.referral : r));
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'success' });
          } else if (msg.type === 'REROUTE_ESCALATED') {
            setReferrals(prev => prev.map(r => r.id === msg.referralId ? msg.referral : r));
            if (msg.message) setLastNotification({ id: Date.now(), text: msg.message, type: 'error' });
          }
        } catch (err) {
          console.error('[WS Parse Error]:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Retry connection in 3 seconds
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

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      hospitals,
      referrals,
      lastNotification,
      setLastNotification,
      refreshAll
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}
