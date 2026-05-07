import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Events from './components/Events';
import Settings from './components/Settings';
import Overlay from './components/Overlay';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [wsUrl, setWsUrl] = useState('');
  const [ip, setIp] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [events, setEvents] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [settings, setSettings] = useState({
    overlayPosition: 'top-right',
    duration: 5,
    soundEnabled: true,
    gamingMode: false,
  });

  // Check if we are in the overlay window
  const isOverlay = window.location.hash === '#overlay';

  useEffect(() => {
    if (isOverlay) return;

    const displayedEvents = new Map();
    const displayedCalls = new Map();

    const normalizeNumber = (num) => {
      if (!num) return '';
      return num.toString().replace(/\D/g, '');
    };

    // Load initial data
    const loadData = async () => {
      const currentIp = await window.electron.getIP();
      const currentUrl = await window.electron.getWSUrl();
      const code = await window.electron.getPairingCode();
      setIp(currentIp);
      setWsUrl(currentUrl);
      setPairingCode(code);

      const savedSettings = localStorage.getItem('milesconnect_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    };

    const savedLogs = localStorage.getItem('milesconnect_call_logs');
    if (savedLogs) {
      setCallLogs(JSON.parse(savedLogs));
    }
    
    loadData();

    // Listen for events
    const unsubStatus = window.electron.onWSStatus((status) => {
      setWsStatus(status);
    });

    const unsubError = window.electron.onWSError((error) => {
      console.error('WS Error:', error);
    });

    const handleEvent = (data) => {
      console.log('RENDERER RECEIVED EVENT:', data);
      
      if (data.type === 'call_log') {
        setCallLogs(data.calls || []);
        localStorage.setItem('milesconnect_call_logs', JSON.stringify(data.calls || []));
        return;
      }

      const now = Date.now();
      
      // Dedupe logic
      if (data.type === 'call') {
        const normalized = normalizeNumber(data.number);
        const dedupeKey = `call|${normalized}`;
        
        if (data.state === 'ringing') {
          const lastTime = displayedCalls.get(dedupeKey);
          if (lastTime && (now - lastTime < 20000)) {
            // Check if we can update the name
            setEvents(prev => {
              const idx = prev.findIndex(e => e.type === 'call' && normalizeNumber(e.number) === normalized && e.state === 'ringing');
              if (idx !== -1 && prev[idx].name === 'Unknown' && data.name !== 'Unknown') {
                const updated = [...prev];
                updated[idx] = data;
                return updated;
              }
              return prev;
            });
            // It's a duplicate ringing (either name update or same), so skip sound
            return;
          }
          displayedCalls.set(dedupeKey, now);
        }
        
        setEvents(prev => [data, ...prev].slice(0, 20));
      } else {
        const dedupeKey = `${data.type}|${data.app || data.package || ''}|${data.title || data.name || ''}|${data.text || data.number || ''}`;
        if (displayedEvents.has(dedupeKey) && (now - displayedEvents.get(dedupeKey) < 10000)) {
          console.log('Renderer dedupe blocked duplicate event');
          return;
        }
        displayedEvents.set(dedupeKey, now);
        setEvents(prev => [data, ...prev].slice(0, 20));
      }

      // Audio & Voice Logic
      const isCall = data.type === 'call' && data.state === 'ringing';
      const isNotif = data.type === 'notification';

      if (isCall || isNotif) {
        const soundSetting = isCall ? settings.callSound : settings.notificationSound;
        const volume = isCall ? (settings.callVolume ?? 0.5) : (settings.notificationVolume ?? 0.5);
        const shouldAnnounce = isCall ? settings.announceCalls : settings.announceNotifications;

        // Play Sound
        if (soundSetting !== 'off') {
          let src = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Default
          if (soundSetting && soundSetting !== 'default') {
            const normalizedPath = soundSetting.replace(/\\/g, '/');
            src = normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`;
          }
          const audio = new Audio(src);
          audio.volume = volume;
          audio.play().catch(e => console.error('Failed to play sound:', e));
        }

        // Voice Announcement
        if (shouldAnnounce && window.speechSynthesis) {
          const text = isCall 
            ? `Incoming call from ${data.name || data.number || 'Unknown'}`
            : `Notification from ${data.app || 'an app'}`;
          
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.volume = volume;
          window.speechSynthesis.speak(utterance);
        }
      }
    };

    const unsubEvent = window.electron.onWSEvent(handleEvent);

    const unsubGaming = window.electron.onToggleGamingMode((enabled) => {
      setSettings(prev => ({ ...prev, gamingMode: enabled }));
    });

    return () => {
      unsubStatus();
      unsubError();
      unsubEvent();
      unsubGaming();
    };
  }, [isOverlay]);

  if (isOverlay) {
    return <Overlay />;
  }

  const clearEvents = () => setEvents([]);

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard 
            wsStatus={wsStatus} 
            wsUrl={wsUrl} 
            ip={ip} 
            pairingCode={pairingCode}
            events={events} 
          />
        )}
        
        {activeTab === 'events' && (
          <Events 
            events={events} 
            callLogs={callLogs}
            clearEvents={clearEvents} 
          />
        )}
        
        {activeTab === 'settings' && (
          <Settings 
            settings={settings} 
            setSettings={setSettings} 
          />
        )}
      </main>

    </div>
  );
}

export default App;
