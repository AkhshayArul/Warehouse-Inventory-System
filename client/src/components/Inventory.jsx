import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Inventory({ user, onOpenMovementModal }) {
  const [inventory, setInventory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState(user.role === 'admin' ? '' : user.warehouse_id);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    // If admin, load warehouses list for filter dropdown
    if (user.role === 'admin') {
      api.getWarehouses().then(setWarehouses).catch(console.error);
    }
  }, [user.role]);

  const loadInventoryData = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (selectedWarehouse) filters.warehouse_id = selectedWarehouse;
      if (searchTerm) filters.search = searchTerm;
      if (selectedCategory) filters.category = selectedCategory;
      if (lowStockOnly) filters.low_stock_only = 'true';

      const [invData, sumData] = await Promise.all([
        api.getInventory(filters),
        api.getInventorySummary(selectedWarehouse || null)
      ]);

      setInventory(invData);
      setSummary(sumData);

      // Extract unique categories
      const cats = Array.from(new Set(invData.map(i => i.category))).filter(Boolean);
      setCategories(prev => (prev.length > 0 ? prev : cats));
    } catch (err) {
      setError(err.message || 'Failed to fetch inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, [selectedWarehouse, selectedCategory, lowStockOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadInventoryData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouse Stock Inventory</h1>
          <p className="page-subtitle">Real-time stock ledger backed by MySQL view <code>vw_inventory_details</code></p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadInventoryData}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={() => onOpenMovementModal()}>+ Record Movement</button>
        </div>
      </div>

      {/* Stored Procedure KPI Metrics Bar */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: '16px' }}>
          <div className="stat-card" style={{ padding: '14px 18px' }}>
            <span className="stat-title">Distinct Products</span>
            <div className="stat-value" style={{ fontSize: '20px', margin: '4px 0' }}>
              {summary.total_distinct_products}
            </div>
            <span className="stat-desc">Stocked items</span>
          </div>

          <div className="stat-card" style={{ padding: '14px 18px' }}>
            <span className="stat-title">Total Units</span>
            <div className="stat-value" style={{ fontSize: '20px', margin: '4px 0' }}>
              {Number(summary.total_units).toLocaleString()}
            </div>
            <span className="stat-desc">Physical shelf units</span>
          </div>

          <div className="stat-card" style={{ padding: '14px 18px' }}>
            <span className="stat-title">Inventory Value</span>
            <div className="stat-value" style={{ fontSize: '20px', margin: '4px 0' }}>
              ${Number(summary.total_inventory_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="stat-desc">Stored procedure total</span>
          </div>

          <div className={`stat-card ${summary.low_stock_items_count > 0 ? 'alert' : ''}`} style={{ padding: '14px 18px' }}>
            <span className="stat-title">Low Stock Warnings</span>
            <div className="stat-value" style={{ fontSize: '20px', margin: '4px 0' }}>
              {summary.low_stock_items_count}
            </div>
            <span className="stat-desc">Below reorder point</span>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <form className="filter-bar" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className="search-input"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

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

          <select
            className="select-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            <span>⚠️ Low Stock Only</span>
          </label>

          <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
          {(searchTerm || selectedCategory || (user.role === 'admin' && selectedWarehouse) || lowStockOnly) && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                if (user.role === 'admin') setSelectedWarehouse('');
                setLowStockOnly(false);
              }}
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {error && <div className="alert-box alert-danger">{error}</div>}

      {/* Inventory Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                {user.role === 'admin' && <th>Warehouse</th>}
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Reorder Level</th>
                <th>Unit Price</th>
                <th>Inventory Value</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={user.role === 'admin' ? 10 : 9} style={{ textAlign: 'center', padding: '32px' }}>
                    Loading inventory records...
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={user.role === 'admin' ? 10 : 9} style={{ textAlign: 'center', padding: '32px' }}>
                    No inventory records match the selected filters.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={`${item.warehouse_id}_${item.product_id}`}>
                    {user.role === 'admin' && (
                      <td>
                        <strong>{item.warehouse_name}</strong>
                      </td>
                    )}
                    <td><code className="font-mono">{item.sku}</code></td>
                    <td><strong>{item.product_name}</strong></td>
                    <td>{item.category}</td>
                    <td>
                      <strong style={{ fontSize: '15px' }}>{item.quantity}</strong> units
                    </td>
                    <td>{item.reorder_level} units</td>
                    <td>${Number(item.unit_price).toFixed(2)}</td>
                    <td>
                      <strong>${Number(item.inventory_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </td>
                    <td>
                      {item.is_low_stock ? (
                        <span className="badge badge-low-stock">⚠️ Low Stock</span>
                      ) : (
                        <span className="badge badge-optimal">✓ Healthy</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          title="Record IN movement"
                          onClick={() => onOpenMovementModal({
                            warehouse_id: item.warehouse_id,
                            product_id: item.product_id,
                            movement_type: 'IN'
                          })}
                        >
                          + IN
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          title="Record OUT movement"
                          disabled={item.quantity <= 0}
                          onClick={() => onOpenMovementModal({
                            warehouse_id: item.warehouse_id,
                            product_id: item.product_id,
                            movement_type: 'OUT'
                          })}
                        >
                          - OUT
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
    </div>
  );
}
