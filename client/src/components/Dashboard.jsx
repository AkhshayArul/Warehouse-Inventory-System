import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Dashboard({ user, onNavigateToInventory, onOpenMovementModal }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDashboardReport();
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="card-body">Loading dashboard analytics...</div>;
  }

  if (error) {
    return <div className="alert-box alert-danger">{error}</div>;
  }

  const { summary, by_warehouse, by_category, by_movement_type, recent_movements, low_stock_items } = report;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {user.role === 'admin' ? 'Global Warehouse Overview' : `${user.warehouse_name || 'Warehouse'} Dashboard`}
          </h1>
          <p className="page-subtitle">Real-time inventory levels, valuation, and transaction activity</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadData}>🔄 Refresh Data</button>
          <button className="btn btn-primary" onClick={() => onOpenMovementModal()}>+ Record Movement</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-title">Cataloged Products</span>
          <div className="stat-value">{summary.total_products || 0}</div>
          <span className="stat-desc">Distinct items currently stocked</span>
        </div>

        <div className="stat-card">
          <span className="stat-title">Total Units In Stock</span>
          <div className="stat-value">{Number(summary.total_units || 0).toLocaleString()}</div>
          <span className="stat-desc">Physical items across shelves</span>
        </div>

        <div className="stat-card">
          <span className="stat-title">Total Valuation</span>
          <div className="stat-value">${Number(summary.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <span className="stat-desc">Calculated at current product unit prices</span>
        </div>

        <div className={`stat-card ${summary.low_stock_count > 0 ? 'alert' : ''}`}>
          <span className="stat-title">Low Stock Alerts</span>
          <div className="stat-value">{summary.low_stock_count || 0}</div>
          <span className="stat-desc">
            {summary.low_stock_count > 0 ? 'Items at or below reorder threshold' : 'All inventory levels healthy'}
          </span>
        </div>
      </div>

      {/* Low Stock Alerts Banner / List */}
      {low_stock_items && low_stock_items.length > 0 && (
        <div className="card" style={{ borderColor: '#fca5a5' }}>
          <div className="card-header" style={{ background: '#fffafa' }}>
            <span className="card-title" style={{ color: 'var(--danger)' }}>
              ⚠️ Low Stock Attention Required ({low_stock_items.length} items)
            </span>
            <button className="btn btn-sm btn-outline-danger" onClick={onNavigateToInventory}>
              View in Inventory
            </button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {low_stock_items.slice(0, 6).map((item) => (
                  <tr key={`${item.warehouse_id}_${item.product_id}`}>
                    <td><strong>{item.warehouse_name}</strong></td>
                    <td>{item.product_name}</td>
                    <td><code className="font-mono">{item.sku}</code></td>
                    <td>{item.category}</td>
                    <td>
                      <span className="badge badge-low-stock">{item.quantity} units</span>
                    </td>
                    <td>{item.reorder_level} units</td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => onOpenMovementModal({
                          warehouse_id: item.warehouse_id,
                          product_id: item.product_id,
                          movement_type: 'IN'
                        })}
                      >
                        + Restock IN
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warehouse & Category breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: user.role === 'admin' ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Warehouse Breakdown (Admin only) */}
        {user.role === 'admin' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏢 Inventory by Warehouse</span>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Manager</th>
                    <th>Items</th>
                    <th>Units</th>
                    <th>Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {by_warehouse.map((w) => (
                    <tr key={w.warehouse_id}>
                      <td><strong>{w.warehouse_name}</strong></td>
                      <td>{w.manager_name || 'Unassigned'}</td>
                      <td>{w.product_count}</td>
                      <td>{Number(w.total_quantity).toLocaleString()}</td>
                      <td>${Number(w.warehouse_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🏷️ Stock by Product Category</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Units</th>
                  <th>Category Valuation</th>
                </tr>
              </thead>
              <tbody>
                {by_category.map((c) => (
                  <tr key={c.category}>
                    <td><strong>{c.category}</strong></td>
                    <td>{c.category_products}</td>
                    <td>{Number(c.total_units).toLocaleString()}</td>
                    <td>${Number(c.category_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🕒 Recent Stock Movements Audit Trail</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {by_movement_type && by_movement_type.map((m) => (
              <span key={m.movement_type} className={`badge badge-${m.movement_type.toLowerCase()}`}>
                {m.movement_type}: {m.transaction_count} tx ({m.total_quantity_moved} units)
              </span>
            ))}
          </div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Type</th>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Quantity</th>
                <th>Ref #</th>
                <th>Performed By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {recent_movements.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No stock movements recorded yet.</td>
                </tr>
              ) : (
                recent_movements.map((m) => (
                  <tr key={m.movement_id}>
                    <td>{new Date(m.movement_date).toLocaleString()}</td>
                    <td>
                      <span className={`badge badge-${m.movement_type.toLowerCase()}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td><strong>{m.product_name}</strong> (<code className="font-mono">{m.sku}</code>)</td>
                    <td>{m.warehouse_name}</td>
                    <td><strong>{m.quantity}</strong></td>
                    <td><code className="font-mono">{m.reference_number || '-'}</code></td>
                    <td>{m.user_name}</td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.notes || '-'}
                    </td>
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
