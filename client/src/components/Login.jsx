import React, { useState } from 'react';
import { api } from '../api';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@warehouse.com');
  const [password, setPassword] = useState('admin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.login(email, password);
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">📦</div>
          <h1 className="login-title">Warehouse Management</h1>
          <p className="login-subtitle">Sign in to access your inventory workspace</p>
        </div>

        {error && <div className="alert-box alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="e.g. admin@warehouse.com" 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter password" 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px', padding: '10px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-credentials-box">
          <div className="demo-title">Quick Demo Login</div>
          <div className="demo-buttons">
            <button 
              type="button" 
              className="demo-btn"
              onClick={() => fillCredentials('admin@warehouse.com', 'admin@123')}
            >
              <span><strong>Admin:</strong> admin@warehouse.com</span>
              <span className="role-tag role-admin">admin</span>
            </button>

            <button 
              type="button" 
              className="demo-btn"
              onClick={() => fillCredentials('alexmanager@company.com', 'PASSWORD')}
            >
              <span><strong>Manager (Central):</strong> alexmanager@company.com</span>
              <span className="role-tag role-manager">manager</span>
            </button>

            <button 
              type="button" 
              className="demo-btn"
              onClick={() => fillCredentials('arjunkumar@company.com', 'PASSWORD')}
            >
              <span><strong>Staff (Central):</strong> arjunkumar@company.com</span>
              <span className="role-tag role-staff">staff</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
