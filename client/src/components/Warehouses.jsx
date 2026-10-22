import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Warehouses({ user }) {
  const [warehouses, setWarehouses] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formData, setFormData] = useState({
    warehouse_name: '',
    location: '',
    manager_id: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [wList, uList] = await Promise.all([
        api.getWarehouses(),
        api.getUsers({ role: 'manager' })
      ]);
      setWarehouses(wList);
      setManagers(uList);
    } catch (err) {
      setError(err.message || 'Failed to load warehouses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormData({
      warehouse_name: '',
      location: '',
      manager_id: managers.length > 0 ? String(managers[0].user_id) : ''
    });
    setIsModalOpen(true);
    setError('');
    setSuccess('');
  };

  const handleOpenEdit = (w) => {
    setEditingWarehouse(w);
    setFormData({
      warehouse_name: w.warehouse_name,
      location: w.location,
      manager_id: String(w.manager_id)
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
      if (editingWarehouse) {
        await api.updateWarehouse(editingWarehouse.warehouse_id, formData);
        setSuccess(`Warehouse '${formData.warehouse_name}' updated successfully.`);
      } else {
        await api.createWarehouse(formData);
        setSuccess(`Warehouse '${formData.warehouse_name}' created successfully.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save warehouse.');
    }
  };

  const handleDelete = async (warehouseId, warehouseName) => {
    if (!window.confirm(`Are you sure you want to delete "${warehouseName}"? This will check database integrity to prevent unsafe deletion.`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await api.deleteWarehouse(warehouseId);
      setSuccess(`Warehouse "${warehouseName}" removed safely.`);
      loadData();
    } catch (err) {
      setError(err.message || 'Unsafe deletion rejected by system.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouse Management</h1>
          <p className="page-subtitle">Configure logistics facilities, locations, and designated warehouse managers</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadData}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>+ Create Warehouse</button>
        </div>
      </div>

      {success && <div className="alert-box alert-success">{success}</div>}
      {error && <div className="alert-box alert-danger">{error}</div>}

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Warehouse Name</th>
                <th>Physical Location</th>
                <th>Assigned Manager</th>
                <th>Manager Email</th>
                <th>Stocked SKUs</th>
                <th>Total Units</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px' }}>
                    Loading warehouse records...
                  </td>
                </tr>
              ) : warehouses.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px' }}>
                    No warehouses configured.
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w.warehouse_id}>
                    <td><code className="font-mono">#{w.warehouse_id}</code></td>
                    <td><strong>{w.warehouse_name}</strong></td>
                    <td>{w.location}</td>
                    <td>
                      <div><strong>{w.manager_name || 'Unassigned'}</strong></div>
                      <span className="role-tag role-manager">Manager</span>
                    </td>
                    <td>{w.manager_email || '-'}</td>
                    <td>{w.distinct_products_count} distinct items</td>
                    <td><strong>{Number(w.total_units_in_stock).toLocaleString()}</strong> units</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(w)}>
                          Edit
                        </button>
                        <button 
                          className="btn btn-outline-danger btn-sm" 
                          onClick={() => handleDelete(w.warehouse_id, w.warehouse_name)}
                          title="Delete warehouse (Enforces foreign key and inventory constraints)"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warehouse Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingWarehouse ? `Edit Warehouse #${editingWarehouse.warehouse_id}` : 'Create New Warehouse'}
              </h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Warehouse Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.warehouse_name}
                    onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                    placeholder="e.g. West Coast Distribution Facility"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Physical Location Address *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. 104 Logistics Blvd, Sector 9"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Designated Manager (Role: Manager) *</label>
                  <select
                    className="form-select"
                    required
                    value={formData.manager_id}
                    onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  >
                    <option value="">Select a Manager...</option>
                    {managers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name} ({m.email}) {m.warehouse_name ? `[Current: ${m.warehouse_name}]` : '[Unassigned]'}
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">
                    DBMS Rule: Each warehouse must have exactly one manager; each manager can manage only one warehouse.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
