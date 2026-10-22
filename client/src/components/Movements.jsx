import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Movements({ user, onOpenMovementModal }) {
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [movementType, setMovementType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState(user.role === 'admin' ? '' : user.warehouse_id);
  const [ownOnly, setOwnOnly] = useState(false);

  useEffect(() => {
    if (user.role === 'admin') {
      api.getWarehouses().then(setWarehouses).catch(console.error);
    }
  }, [user.role]);

  const loadMovements = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (movementType) filters.movement_type = movementType;
      if (searchTerm) filters.search = searchTerm;
      if (selectedWarehouse) filters.warehouse_id = selectedWarehouse;
      if (ownOnly) filters.own_only = 'true';

      const data = await api.getMovements(filters);
      setMovements(data);
    } catch (err) {
      setError(err.message || 'Failed to load stock movements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [movementType, selectedWarehouse, ownOnly]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadMovements();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Movements & Audit Ledger</h1>
          <p className="page-subtitle">Immutable transaction history for inbound, outbound, and physical audit adjustments</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadMovements}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={() => onOpenMovementModal()}>+ Record Movement</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <form className="filter-bar" onSubmit={handleSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by product, SKU, reference number, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="select-input"
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
          >
            <option value="">All Movement Types</option>
            <option value="IN">IN (Incoming Stock)</option>
            <option value="OUT">OUT (Outgoing Stock)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Audit/Correction)</option>
          </select>

          {user.role === 'admin' && (
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
          )}

          {user.role === 'staff' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={ownOnly}
                onChange={(e) => setOwnOnly(e.target.checked)}
              />
              <span>My Recorded Transactions Only</span>
            </label>
          )}

          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
          {(searchTerm || movementType || (user.role === 'admin' && selectedWarehouse) || ownOnly) && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSearchTerm('');
                setMovementType('');
                if (user.role === 'admin') setSelectedWarehouse('');
                setOwnOnly(false);
              }}
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {error && <div className="alert-box alert-danger">{error}</div>}

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Warehouse</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Reference #</th>
                <th>Operator</th>
                <th>Notes / Audit Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '32px' }}>
                    Loading movements audit trail...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '32px' }}>
                    No stock movements found matching current filters.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.movement_id}>
                    <td><code className="font-mono">#{m.movement_id}</code></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(m.movement_date).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge badge-${m.movement_type.toLowerCase()}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td><strong>{m.warehouse_name}</strong></td>
                    <td>
                      <strong>{m.product_name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        <code className="font-mono">{m.sku}</code> • {m.category}
                      </div>
                    </td>
                    <td>
                      <strong style={{ fontSize: '14px' }}>
                        {m.movement_type === 'OUT' ? `-${m.quantity}` : (m.movement_type === 'IN' ? `+${m.quantity}` : m.quantity)}
                      </strong> units
                    </td>
                    <td><code className="font-mono">{m.reference_number || '-'}</code></td>
                    <td>
                      <div>{m.user_name}</div>
                      <span className={`role-tag role-${m.user_role}`}>{m.user_role}</span>
                    </td>
                    <td style={{ maxWidth: '280px' }}>{m.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
