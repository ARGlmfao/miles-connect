import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';

const Overlay = () => {
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({
    duration: 5,
    overlayPosition: 'top-right',
  });

  useEffect(() => {
    // Safety dedupe for display
    const displayedOverlays = new Map();

    // Load settings
    const saved = localStorage.getItem('milesconnect_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
    const normalizeNumber = (num) => {
      if (!num) return '';
      return num.toString().replace(/\D/g, '');
    };

    const handleEvent = (data) => {
      console.log('OVERLAY EVENT RECEIVED');
      console.log('OVERLAY RECEIVED EVENT:', data);

      const now = Date.now();

      // PART A: Advanced Call Deduplication & Contact Resolution
      if (data.type === 'call') {
        const normalizedNumber = normalizeNumber(data.number);
        
        // Find if we already have an active overlay for this number
        setNotifications(prev => {
          const existingCallIndex = prev.findIndex(n => 
            n.type === 'call' && 
            normalizeNumber(n.number) === normalizedNumber && 
            n.state === 'ringing'
          );

          if (existingCallIndex !== -1) {
            const existingCall = prev[existingCallIndex];

            // If the incoming event is not ringing, it means the call changed state (ended/answered)
            if (data.state !== 'ringing') {
              // Only keep if it's a missed call, otherwise remove
              if (data.state === 'missed') {
                const updated = [...prev];
                updated[existingCallIndex] = { ...data, id: existingCall.id };
                setTimeout(() => dismissNotification(existingCall.id), 10000);
                return updated;
              } else {
                return prev.filter(n => n.id !== existingCall.id);
              }
            }

            // If both are ringing, check if we can improve the name
            if (data.state === 'ringing') {
              const currentName = existingCall.name || 'Unknown';
              const newName = data.name || 'Unknown';

              if (currentName === 'Unknown' && newName !== 'Unknown') {
                console.log('Updating Unknown caller with real contact name:', newName);
                const updated = [...prev];
                updated[existingCallIndex] = { ...data, id: existingCall.id };
                return updated;
              } else {
                console.log('Ignoring duplicate ringing event for same number');
                return prev;
              }
            }
          }

          // If no existing call found and it's not ringing/missed, ignore
          if (data.state !== 'ringing' && data.state !== 'missed') return prev;

          // Dedupe by time (20s) if we recently showed this number
          const dedupeKey = `call|${normalizedNumber}`;
          if (displayedOverlays.has(dedupeKey) && (now - displayedOverlays.get(dedupeKey) < 20000)) {
             // Exception: If we have an Unknown and this is a better name, we already handled it above.
             // If we reach here, it's either a fresh call or a duplicate we should ignore.
             console.log('Call dedupe blocked duplicate overlay');
             return prev;
          }
          displayedOverlays.set(dedupeKey, now);

          const id = Date.now() + Math.random();
          const newNotification = { ...data, id };
          
          if (data.state === 'ringing') {
            setTimeout(() => dismissNotification(id), 20000);
          } else if (data.state === 'missed') {
            setTimeout(() => dismissNotification(id), 10000);
          }

          return [...prev, newNotification];
        });
        return;
      }

      // Normal Notification Deduplication
      if (data.isTest) {
        const lastTest = displayedOverlays.get('INTERNAL_TEST_EVENT') || 0;
        if (now - lastTest < 2000) return;
        displayedOverlays.set('INTERNAL_TEST_EVENT', now);
      } else {
        const dedupeKey = `${data.type}|${data.app || data.package || ''}|${data.title || ''}|${data.text || ''}`;
        if (displayedOverlays.has(dedupeKey) && (now - displayedOverlays.get(dedupeKey) < 8000)) {
          console.log('Notification dedupe blocked duplicate display');
          return;
        }
        displayedOverlays.set(dedupeKey, now);
      }

      const id = Date.now() + Math.random();
      const newNotification = { ...data, id };
      
      setNotifications(prev => [...prev, newNotification]);

      if (data.type === 'notification') {
        setTimeout(() => {
          dismissNotification(id);
        }, settings.duration * 1000);
      }
    };

    const unsubEvent = window.electron.onWSEvent(handleEvent);

    return () => {
      unsubEvent();
    };
  }, [settings.duration]);

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Determine flex direction based on position
  const isBottom = settings.overlayPosition.includes('bottom');
  const isLeft = settings.overlayPosition.includes('left');

  return (
    <div className={`overlay-container ${settings.overlayPosition}`}>
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: isLeft ? -100 : 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            layout
            className={`notification-card glass ${notif.type === 'call' ? 'call-card' : ''} ${notif.state === 'ringing' ? 'ringing-large' : ''}`}
            onMouseEnter={() => window.electron.setOverlayIgnoreMouse(false)}
            onMouseLeave={() => window.electron.setOverlayIgnoreMouse(true)}
          >
            {notif.type === 'call' && notif.state === 'ringing' ? (
              <div className="call-overlay-large">
                <div className="call-icon-container">
                  <Phone size={32} className="animate-pulse text-green-400" />
                </div>
                <div className="call-info-large">
                  <h3>Incoming Call</h3>
                  <div className="caller-name">{notif.name || 'Unknown'}</div>
                  <div className="caller-number">{notif.number}</div>
                </div>
                <button className="dismiss-btn-large" onClick={() => dismissNotification(notif.id)}>
                  Dismiss
                </button>
              </div>
            ) : (
              <>
                <div className="card-header">
                  <span className="app-name">
                    {notif.type === 'call' && <Phone size={12} style={{marginRight: 4}} />}
                    {notif.app || (notif.type === 'call' ? 'Miles Connect' : 'System')}
                  </span>
                  <span className="time">
                    {new Date(notif.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="card-title">
                  {notif.type === 'call' && notif.state === 'ended' ? 'Call ended' : (notif.title || notif.name)}
                </div>
                <div className="card-text">
                  {notif.type === 'call' && notif.state === 'ended' ? (
                    <div className="ended-info">
                      <PhoneOff size={14} />
                      <span>{notif.name || notif.number}</span>
                    </div>
                  ) : (
                    notif.text || notif.number || notif.state
                  )}
                </div>
                
                {notif.type === 'call' && (
                  <div className="call-actions">
                    <button className="dismiss-btn" onClick={() => dismissNotification(notif.id)}>Dismiss</button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Overlay;
