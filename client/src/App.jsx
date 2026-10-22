import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Movements from './components/Movements';
import Products from './components/Products';
import Warehouses from './components/Warehouses';
import Users from './components/Users';
import MovementModal from './components/MovementModal';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [movementModalConfig, setMovementModalConfig] = useState(null); // null or { warehouse_id, product_id, movement_type }
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setToastMessage('Session expired. Please log in again.');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const handleLoginSuccess = (token, loggedInUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setActiveTab('dashboard');
    showToast(`Welcome back, ${loggedInUser.full_name}!`);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    showToast('Logged out successfully.');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onOpenMovementModal={(initial) => setMovementModalConfig(initial || {})}
      />

      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 9999,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🔔 {toastMessage}</span>
        </div>
      )}

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            onNavigateToInventory={() => setActiveTab('inventory')}
            onOpenMovementModal={(initial) => setMovementModalConfig(initial || {})}
          />
        )}

        {activeTab === 'inventory' && (
          <Inventory
            user={user}
            onOpenMovementModal={(initial) => setMovementModalConfig(initial || {})}
          />
        )}

        {activeTab === 'movements' && (
          <Movements
            user={user}
            onOpenMovementModal={(initial) => setMovementModalConfig(initial || {})}
          />
        )}

        {activeTab === 'products' && (
          <Products user={user} />
        )}

        {activeTab === 'warehouses' && user.role === 'admin' && (
          <Warehouses user={user} />
        )}

        {activeTab === 'users' && user.role === 'admin' && (
          <Users user={user} />
        )}
      </main>

      {/* Movement Modal */}
      {movementModalConfig !== null && (
        <MovementModal
          user={user}
          initialData={movementModalConfig}
          onClose={() => setMovementModalConfig(null)}
          onSuccess={(msg) => {
            showToast(msg || 'Stock movement recorded successfully!');
            // Trigger refresh by toggling tab or re-render
            setActiveTab(prev => {
              const current = prev;
              return current;
            });
          }}
        />
      )}
    </div>
  );
}
