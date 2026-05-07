import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wifi, WifiOff, Link, Copy, Send, Activity, Radio, Smartphone } from 'lucide-react';

const Dashboard = ({ wsStatus, wsUrl, ip, pairingCode, events }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(wsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Removed sendTest for production Miles Connect rebranding

  const recentEvents = events.slice(0, 3);

  return (
    <div className="dashboard-content">
      <header>
        <h1>System Overview</h1>
      </header>

      <div className="stats-grid">
        <div className="stat-card glass">
          <div className="stat-icon" style={{ color: wsStatus === 'connected' ? 'var(--success)' : 'var(--warning)' }}>
            {wsStatus === 'connected' ? <Wifi size={24} /> : <WifiOff size={24} />}
          </div>
          <div className="stat-info">
            <span className="stat-label">Connection Status</span>
            <span className="stat-value">
              {wsStatus === 'connected' ? 'Phone Connected' : 'Waiting for phone'}
            </span>
          </div>
        </div>

        <div className="stat-card glass">
          <div className="stat-icon" style={{ color: 'var(--accent)' }}>
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Events</span>
            <span className="stat-value">{events.length}</span>
          </div>
        </div>

        <div className="stat-card glass highlight-card">
          <div className="stat-icon" style={{ color: '#38bdf8' }}>
            <Smartphone size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pairing Code</span>
            <span className="stat-value" style={{ letterSpacing: '2px', fontWeight: 'bold' }}>
              {pairingCode || '---'}
            </span>
          </div>
          <div className="broadcast-status">
            <div className="pulse-dot"></div>
            <span>Pairing broadcast active</span>
          </div>
        </div>
      </div>

      <div className="main-grid">
        <div className="qr-section glass">
          <h3>Pairing QR Code</h3>
          <p>Scan this with the Miles Connect Android app to connect.</p>
          <div className="qr-container">
            {wsUrl ? (
              <QRCodeSVG value={wsUrl} size={200} bgColor="transparent" fgColor="#38bdf8" />
            ) : (
              <div className="qr-placeholder">Initializing...</div>
            )}
          </div>
          <div className="url-display">
            <code>{wsUrl}</code>
            <button onClick={copyToClipboard} title="Copy URL">
              <Copy size={16} color={copied ? 'var(--success)' : 'currentColor'} />
            </button>
          </div>
        </div>

        <div className="recent-section glass">
          <div className="section-header">
            <h3>Recent Activity</h3>
            <Link size={18} />
          </div>
          <div className="event-list">
            {recentEvents.length > 0 ? (
              recentEvents.map((event, index) => (
                <div key={index} className="event-item">
                  <div className="event-badge">{event.app?.charAt(0)}</div>
                  <div className="event-details">
                    <span className="event-title">{event.title || event.name}</span>
                    <span className="event-text">{event.text || event.number}</span>
                  </div>
                  <span className="event-time">
                    {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state">No events yet.</div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
