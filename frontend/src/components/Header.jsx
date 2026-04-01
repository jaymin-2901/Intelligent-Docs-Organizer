import React from 'react';

const Header = () => {
  return (
    <header className="app-header">
      <div className="header-content">
        <h1>📚 Intelligent Document Organizer</h1>
        <div className="header-controls">
          <button className="btn-secondary">Settings</button>
          <button className="btn-secondary">Help</button>
        </div>
      </div>
    </header>
  );
};

export default Header;