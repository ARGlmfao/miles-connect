import React from 'react';
import { Volume2, VolumeX, Monitor, Clock, ShieldCheck, Play, Music, Mic, FileAudio } from 'lucide-react';

const Settings = ({ settings, setSettings }) => {
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('milesconnect_settings', JSON.stringify(newSettings));
    
    if (key === 'overlayPosition') {
      window.electron.updateOverlayPosition(value);
    }
  };

  const selectCustomSound = async (type) => {
    const filePath = await window.electron.selectAudioFile();
    if (filePath) {
      updateSetting(type === 'notification' ? 'notificationSound' : 'callSound', filePath);
    }
  };

  const playSound = (type) => {
    const soundPath = type === 'notification' ? settings.notificationSound : settings.callSound;
    const volume = type === 'notification' ? (settings.notificationVolume ?? 0.5) : (settings.callVolume ?? 0.5);
    
    if (soundPath === 'off') return;

    let src = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Default
    if (soundPath && soundPath !== 'default' && soundPath !== 'off') {
      const normalizedPath = soundPath.replace(/\\/g, '/');
      src = normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`;
    }

    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(e => console.error('Failed to play sound:', e));
  };

  const testVoice = (type) => {
    if (!window.speechSynthesis) return;
    const text = type === 'notification' ? 'Notification from WhatsApp' : 'Incoming call from John Doe';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = type === 'notification' ? (settings.notificationVolume ?? 0.5) : (settings.callVolume ?? 0.5);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="settings-content">
      <header>
        <h1>Preferences</h1>
      </header>

      <div className="settings-list">
        <section className="settings-section glass">
          <div className="section-title">
            <Monitor size={18} />
            <span>Overlay Display</span>
          </div>
          
          <div className="setting-item">
            <div className="setting-info">
              <label>Overlay Position</label>
              <p>Choose where notifications appear on your screen.</p>
            </div>
            <select 
              value={settings.overlayPosition} 
              onChange={(e) => updateSetting('overlayPosition', e.target.value)}
            >
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Gaming Mode</label>
              <p>Reduce animation intensity and prioritize performance.</p>
            </div>
            <div className="toggle-switch">
              <input 
                type="checkbox" 
                id="gamingMode" 
                checked={settings.gamingMode}
                onChange={(e) => updateSetting('gamingMode', e.target.checked)}
              />
              <label htmlFor="gamingMode"></label>
            </div>
          </div>
        </section>

        <section className="settings-section glass">
          <div className="section-title">
            <Music size={18} />
            <span>Sound & Audio</span>
          </div>

          {/* Notifications Sound */}
          <div className="setting-group">
            <h4>Notifications</h4>
            <div className="setting-item">
              <div className="setting-info">
                <label>Sound</label>
                <div className="sound-path-display">
                  {settings.notificationSound === 'off' ? 'Off' : (settings.notificationSound === 'default' || !settings.notificationSound ? 'Default' : settings.notificationSound.split(/[\\/]/).pop())}
                </div>
              </div>
              <div className="sound-actions">
                <select 
                  value={settings.notificationSound?.startsWith('C:') || settings.notificationSound?.startsWith('/') ? 'custom' : (settings.notificationSound || 'default')} 
                  onChange={(e) => {
                    if (e.target.value === 'custom') selectCustomSound('notification');
                    else updateSetting('notificationSound', e.target.value);
                  }}
                >
                  <option value="default">Default</option>
                  <option value="off">Off</option>
                  <option value="custom">Custom File...</option>
                </select>
                <button className="btn-icon" onClick={() => playSound('notification')} title="Test Sound">
                  <Play size={14} />
                </button>
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-info">
                <label>Volume</label>
              </div>
              <div className="range-container">
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={settings.notificationVolume ?? 0.5}
                  onChange={(e) => updateSetting('notificationVolume', parseFloat(e.target.value))}
                />
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-info">
                <label>Voice Announcement</label>
                <p>Speak "Notification from [App]"</p>
              </div>
              <div className="toggle-switch">
                <input 
                  type="checkbox" id="announceNotifications" 
                  checked={settings.announceNotifications}
                  onChange={(e) => updateSetting('announceNotifications', e.target.checked)}
                />
                <label htmlFor="announceNotifications"></label>
              </div>
              <button className="btn-icon" onClick={() => testVoice('notification')} title="Test Voice">
                <Mic size={14} />
              </button>
            </div>
          </div>

          <hr className="setting-divider" />

          {/* Calls Sound */}
          <div className="setting-group">
            <h4>Incoming Calls</h4>
            <div className="setting-item">
              <div className="setting-info">
                <label>Ringtone</label>
                <div className="sound-path-display">
                  {settings.callSound === 'off' ? 'Off' : (settings.callSound === 'default' || !settings.callSound ? 'Default' : settings.callSound.split(/[\\/]/).pop())}
                </div>
              </div>
              <div className="sound-actions">
                <select 
                  value={settings.callSound?.startsWith('C:') || settings.callSound?.startsWith('/') ? 'custom' : (settings.callSound || 'default')} 
                  onChange={(e) => {
                    if (e.target.value === 'custom') selectCustomSound('call');
                    else updateSetting('callSound', e.target.value);
                  }}
                >
                  <option value="default">Default</option>
                  <option value="off">Off</option>
                  <option value="custom">Custom File...</option>
                </select>
                <button className="btn-icon" onClick={() => playSound('call')} title="Test Sound">
                  <Play size={14} />
                </button>
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-info">
                <label>Volume</label>
              </div>
              <div className="range-container">
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={settings.callVolume ?? 0.5}
                  onChange={(e) => updateSetting('callVolume', parseFloat(e.target.value))}
                />
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-info">
                <label>Voice Announcement</label>
                <p>Speak "Incoming call from [Name]"</p>
              </div>
              <div className="toggle-switch">
                <input 
                  type="checkbox" id="announceCalls" 
                  checked={settings.announceCalls}
                  onChange={(e) => updateSetting('announceCalls', e.target.checked)}
                />
                <label htmlFor="announceCalls"></label>
              </div>
              <button className="btn-icon" onClick={() => testVoice('call')} title="Test Voice">
                <Mic size={14} />
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section glass">
          <div className="section-title">
            <Clock size={18} />
            <span>Behavior</span>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>Notification Duration</label>
              <p>How long normal notifications stay visible (seconds).</p>
            </div>
            <div className="range-container">
              <span>{settings.duration}s</span>
              <input 
                type="range" 
                min="3" 
                max="15" 
                value={settings.duration}
                onChange={(e) => updateSetting('duration', parseInt(e.target.value))}
              />
            </div>
          </div>
        </section>

        <section className="settings-section glass">
          <div className="section-title">
            <Monitor size={18} />
            <span>Developer / Testing</span>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <label>Test Overlay System</label>
              <p>Trigger a sample notification to verify the overlay appears correctly.</p>
            </div>
            <button 
              className="btn-primary" 
              onClick={() => {
                window.electron.sendTestNotification({
                  type: 'notification',
                  app: 'Miles Connect',
                  title: 'Reliability Test',
                  text: 'Overlay system is working correctly!',
                  time: Date.now()
                });
              }}
            >
              Test Overlay
            </button>
          </div>
        </section>

        <section className="settings-section glass">
          <div className="section-title">
            <ShieldCheck size={18} />
            <span>App Filter</span>
          </div>
          <div className="placeholder-info">
            App-specific filtering can be managed from the Android app. 
            Local whitelist/blacklist coming soon.
          </div>
        </section>
      </div>

    </div>
  );
};

export default Settings;
