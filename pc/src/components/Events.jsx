import React, { useState } from 'react';
import { Trash2, Smartphone, Phone, Clock, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';

const Events = ({ events, callLogs, clearEvents }) => {
  const [activeSubTab, setActiveSubTab] = useState('recent');

  const getCallIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'incoming': return <PhoneIncoming size={14} className="text-blue-400" />;
      case 'outgoing': return <PhoneOutgoing size={14} className="text-green-400" />;
      case 'missed': return <PhoneMissed size={14} className="text-red-400" />;
      default: return <Phone size={14} />;
    }
  };

  return (
    <div className="events-content">
      <header>
        <div className="title-group">
          <h1>Event History</h1>
          <div className="sub-tabs">
            <button 
              className={`sub-tab ${activeSubTab === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('recent')}
            >
              Recent Activity
            </button>
            <button 
              className={`sub-tab ${activeSubTab === 'calls' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('calls')}
            >
              Call Logs
            </button>
          </div>
        </div>
        {activeSubTab === 'recent' && (
          <button className="btn-clear" onClick={clearEvents} disabled={events.length === 0}>
            <Trash2 size={16} />
            <span>Clear Logs</span>
          </button>
        )}
      </header>

      <div className="events-table-container glass">
        {activeSubTab === 'recent' ? (
          <table className="events-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>App / Caller</th>
                <th>Content</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.length > 0 ? (
                events.map((event, index) => (
                  <tr key={index}>
                    <td>
                      <div className={`type-badge ${event.type}`}>
                        {event.type === 'call' ? <Phone size={14} /> : <Smartphone size={14} />}
                        <span>{event.type}</span>
                      </div>
                    </td>
                    <td>
                      <div className="app-info">
                        <strong>{event.app || event.name || 'Unknown'}</strong>
                        {event.number && <span className="sub-text">{event.number}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="event-msg">
                        {event.text || (event.state === 'ringing' ? 'Incoming call...' : event.state)}
                      </div>
                    </td>
                    <td>
                      <span className="time-text">
                        {new Date(event.time).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="empty-row">
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="events-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Type / State</th>
                <th>Time</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {callLogs && callLogs.length > 0 ? (
                callLogs.map((log, index) => (
                  <tr key={index}>
                    <td>
                      <div className="app-info">
                        <strong>{log.name || 'Unknown'}</strong>
                        <span className="sub-text">{log.number}</span>
                      </div>
                    </td>
                    <td>
                      <div className={`type-badge call-state ${log.type || log.state}`}>
                        {getCallIcon(log.type || log.state)}
                        <span>{log.type || log.state}</span>
                      </div>
                    </td>
                    <td>
                      <span className="time-text">
                        {new Date(log.time).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      {log.duration ? (
                        <div className="duration-info">
                          <Clock size={12} />
                          <span>{log.duration}s</span>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="empty-row">
                    No call logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Events;
