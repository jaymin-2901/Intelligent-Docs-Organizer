import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/dashboard/overview' },
  { id: 'documents', label: 'All Documents', icon: 'documents', to: '/dashboard/doc-view' },
  { id: 'categories', label: 'Categories', icon: 'categories', to: '/dashboard/categories' },
  { id: 'insights', label: 'Gesture Guide', icon: 'insights', to: '/dashboard/gesture-guide' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics', to: '/dashboard/analytics' },
];

const SidebarIcon = ({ name }) => {
  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="dashboard-sidebar__icon-svg">
          <path d="M3 11.5L12 4l9 7.5" />
          <path d="M5 10.5V20h14v-9.5" />
        </svg>
      );
    case 'documents':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="dashboard-sidebar__icon-svg">
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
          <path d="M10 13h6" />
          <path d="M10 17h6" />
        </svg>
      );
    case 'categories':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="dashboard-sidebar__icon-svg">
          <rect x="3.5" y="4" width="7.5" height="7.5" rx="1.3" />
          <rect x="13" y="4" width="7.5" height="7.5" rx="1.3" />
          <rect x="3.5" y="13" width="17" height="7.5" rx="1.3" />
        </svg>
      );
    case 'insights':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="dashboard-sidebar__icon-svg">
          <path d="M12 3l2.2 4.7L19 10l-4.8 2.3L12 17l-2.2-4.7L5 10l4.8-2.3z" />
          <path d="M5 16l1.2 2.5L9 19.7 6.2 21 5 23.5 3.8 21 1 19.7l2.8-1.2z" />
        </svg>
      );
    case 'analytics':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="dashboard-sidebar__icon-svg">
          <path d="M4 20V9" />
          <path d="M10 20V5" />
          <path d="M16 20v-8" />
          <path d="M22 20V3" />
        </svg>
      );
    default:
      return null;
  }
};

const Sidebar = ({ collapsed, onToggleCollapse }) => {
  return (
    <div className={`dashboard-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="dashboard-sidebar__top">
        <div className="dashboard-sidebar__brand" aria-label="Application brand">
          <span className="dashboard-sidebar__brand-mark">IO</span>
          <div className="dashboard-sidebar__brand-copy">
            <strong>Intelligent Docs</strong>
            <span>Syllabus Organizer</span>
          </div>
        </div>

        <button
          type="button"
          className="dashboard-sidebar__collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="dashboard-sidebar__nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          return (
            <NavLink
              key={item.id}
              to={item.to}
              end
              className={({ isActive }) => `dashboard-sidebar__item${isActive ? ' active' : ''}`}
              title={item.label}
              data-tooltip={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
            >
              <span className="dashboard-sidebar__icon" aria-hidden="true"><SidebarIcon name={item.icon} /></span>
              <span className="dashboard-sidebar__label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="dashboard-sidebar__footer">
        <span>Desktop AI Workspace</span>
      </div>
    </div>
  );
};

export default Sidebar;