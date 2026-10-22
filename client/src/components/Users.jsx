import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Users({ user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    new_password: '',
    phone: '',
    role: 'staff',
    warehouse_id: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (searchTerm) filters.search = searchTerm;
      if (selectedRole) filters.role = selectedRole;
      if (selectedWarehouse) filters.warehouse_id = selectedWarehouse;

      const [uList, wList] = await Promise.all([
        api.getUsers(filters),
        api.getWarehouses()
      ]);
      setUsers(uList);
      setWarehouses(wList);
    } catch (err) {
      setError(err.message || 'Failed to load user list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRole, selectedWarehouse]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      full_name: '',
      email: '',
      password: '',
      new_password: '',
      phone: '',
      role: 'staff',
      warehouse_id: warehouses.length > 0 ? String(warehouses[0].warehouse_id) : ''
    });
    setIsModalOpen(true);
    setError('');
    setSuccess('');
  };

  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setFormData({
      full_name: u.full_name,
      email: u.email,
      password: '',
      new_password: '',
      phone: u.phone || '',
      role: u.role,
      warehouse_id: u.warehouse_id ? String(u.warehouse_id) : ''
    });
    setIsModalOpen(true);
    setError('');
    setSuccess('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        await api.updateUser(editingUser.user_id, {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          warehouse_id: formData.role === 'admin' ? null : (formData.warehouse_id ? parseInt(formData.warehouse_id, 10) : null),
          new_password: formData.new_password
        });
        setSuccess(`User '${formData.full_name}' updated successfully.`);
      } else {
        await api.createUser({
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          role: formData.role,
          warehouse_id: formData.role === 'admin' ? null : (formData.warehouse_id ? parseInt(formData.warehouse_id, 10) : null)
        });
        setSuccess(`User '${formData.full_name}' created successfully.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save user.');
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? Safe deletion will be verified against transactions and assignments.`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await api.deleteUser(userId);
      setSuccess(`User "${userName}" deleted safely.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Cannot delete user.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User & Role Management</h1>
          <p className="page-subtitle">Manage administrative, managerial, and warehouse floor personnel access</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadData}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>+ Create User</button>
        </div>
      </div>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-danger">{error}</div>}

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <form className="filter-bar" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Search users by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="select-input"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>

          <select
            className="select-input"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.warehouse_name}
              </option>
            ))}
          </select>

          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
          {(searchTerm || selectedRole || selectedWarehouse) && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedRole('');
                setSelectedWarehouse('');
              }}
            >
              Reset
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Assigned Warehouse</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px' }}>
                    Loading user accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px' }}>
                    No users match the search criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id}>
                    <td><code className="font-mono">#{u.user_id}</code></td>
                    <td>
                      <strong>{u.full_name}</strong>
                      {u.user_id === currentUser.user_id && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--primary)' }}>
                          (You)
                        </span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>{u.phone || '-'}</td>
                    <td>
                      <span className={`role-tag role-${u.role}`}>{u.role}</span>
                    </td>
                    <td>
                      {u.warehouse_name ? (
                        <span>
                          {u.warehouse_name}
                          {u.is_warehouse_manager ? ' 👑 (Facility Manager)' : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None (Global)</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(u)}>
                          Edit
                        </button>
                        {u.user_id !== currentUser.user_id && (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDelete(u.user_id, u.full_name)}
                            title="Safe delete (checks audit history and manager links)"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUser ? `Edit Account: ${editingUser.full_name}` : 'Create New User Account'}
              </h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. johndoe@company.com"
                  />
                </div>

                {!editingUser ? (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">New Password (Leave blank to keep existing)</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.new_password}
                      onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                      placeholder="Enter new password to reset"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Phone Number (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +1-555-0199"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">System Role *</label>
                    <select
                      className="form-select"
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Warehouse Manager</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Warehouse Assignment {formData.role !== 'admin' ? '*' : '(Optional)'}
                    </label>
                    <select
                      className="form-select"
                      required={formData.role !== 'admin'}
                      disabled={formData.role === 'admin'}
                      value={formData.warehouse_id}
                      onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                    >
                      <option value="">{formData.role === 'admin' ? 'None (Global Admin)' : 'Select Warehouse...'}</option>
                      {warehouses.map((w) => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {w.warehouse_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
