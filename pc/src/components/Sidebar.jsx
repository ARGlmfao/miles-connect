import React from 'react';
import { LayoutDashboard, ListFilter, Settings, Smartphone } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'events', label: 'Events', icon: ListFilter },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="sidebar">
      <div className="logo">
        <Smartphone className="logo-icon" size={24} />
        <span>Miles Connect</span>
      </div>
      <nav>
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="version">v1.0.0</div>
      </div>

    </div>
  );
};

export default Sidebar;
