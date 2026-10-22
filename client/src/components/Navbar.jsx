import React from 'react';

export default function Navbar({ user, activeTab, setActiveTab, onLogout, onOpenMovementModal }) {
  const roleClass = user.role === 'admin' ? 'role-admin' : (user.role === 'manager' ? 'role-manager' : 'role-staff');

  return (
    <header className="navbar">
      <div className="nav-brand">
        <span>📦 WMS Inventory</span>
        <span className="brand-badge">DBMS v1.0</span>
      </div>

      <nav className="nav-links">
        <button 
          className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>

        <button 
          className={`nav-link ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          📦 Inventory
        </button>

        <button 
          className={`nav-link ${activeTab === 'movements' ? 'active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          🔄 Movements
        </button>

        <button 
          className={`nav-link ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          🏷️ Products
        </button>

        {user.role === 'admin' && (
          <>
            <button 
              className={`nav-link ${activeTab === 'warehouses' ? 'active' : ''}`}
              onClick={() => setActiveTab('warehouses')}
            >
              🏢 Warehouses
            </button>

            <button 
              className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Users
            </button>
          </>
        )}
      </nav>

      <div className="nav-user">
        <button className="btn btn-primary btn-sm" onClick={() => onOpenMovementModal()}>
          + Record Movement
        </button>

        <div className="user-info">
          <div className="user-name">{user.full_name}</div>
          <div className="user-meta">
            <span className={`role-tag ${roleClass}`}>{user.role}</span>
            {user.warehouse_name ? ` • ${user.warehouse_name}` : ' • All Warehouses'}
          </div>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={onLogout} title="Log out">
          Logout
        </button>
      </div>
    </header>
  );
}
