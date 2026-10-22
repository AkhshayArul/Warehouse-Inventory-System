import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function MovementModal({ user, initialData, onClose, onSuccess }) {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    warehouse_id: user.role === 'admin' ? (initialData?.warehouse_id || '') : user.warehouse_id,
    product_id: initialData?.product_id || '',
    movement_type: initialData?.movement_type || 'IN',
    quantity: '1',
    adjustment_action: 'INCREASE',
    reference_number: '',
    notes: ''
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const [wList, pData] = await Promise.all([
          api.getWarehouses(),
          api.getProducts()
        ]);
        setWarehouses(wList);
        setProducts(pData.products || []);

        if (user.role === 'admin' && !formData.warehouse_id && wList.length > 0) {
          setFormData(prev => ({ ...prev, warehouse_id: wList[0].warehouse_id }));
        }
        if (!formData.product_id && pData.products && pData.products.length > 0) {
          setFormData(prev => ({ ...prev, product_id: pData.products[0].product_id }));
        }
      } catch (err) {
        setError('Failed to load warehouses or products.');
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const qty = parseInt(formData.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive whole number greater than 0.');
      return;
    }

    if (!formData.warehouse_id || !formData.product_id) {
      setError('Please select both a warehouse and a product.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.recordMovement({
        warehouse_id: parseInt(formData.warehouse_id, 10),
        product_id: parseInt(formData.product_id, 10),
        movement_type: formData.movement_type,
        quantity: qty,
        adjustment_action: formData.adjustment_action,
        reference_number: formData.reference_number,
        notes: formData.notes
      });

      onSuccess(res.message);
      onClose();
    } catch (err) {
      setError(err.message || 'Movement transaction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Record Stock Movement</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="modal-body">Loading products and facilities...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert-box alert-danger">{error}</div>}

              {/* Movement Type */}
              <div className="form-group">
                <label className="form-label">Transaction Type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${formData.movement_type === 'IN' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFormData({ ...formData, movement_type: 'IN' })}
                  >
                    📥 IN (Receive)
                  </button>
                  <button
                    type="button"
                    className={`btn ${formData.movement_type === 'OUT' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setFormData({ ...formData, movement_type: 'OUT' })}
                  >
                    📤 OUT (Dispatch)
                  </button>
                  <button
                    type="button"
                    className={`btn ${formData.movement_type === 'ADJUSTMENT' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFormData({ ...formData, movement_type: 'ADJUSTMENT' })}
                  >
                    ⚖️ ADJUSTMENT
                  </button>
                </div>
              </div>

              {/* Warehouse Selection */}
              <div className="form-group">
                <label className="form-label">Warehouse Facility *</label>
                {user.role === 'admin' ? (
                  <select
                    className="form-select"
                    required
                    value={formData.warehouse_id}
                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                  >
                    {warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>
                        {w.warehouse_name} ({w.location})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    disabled
                    value={`${user.warehouse_name || 'Assigned Warehouse'} (ID: ${user.warehouse_id})`}
                  />
                )}
                <span className="form-hint">
                  {user.role !== 'admin' ? 'Enforced by warehouse authorization policy.' : 'Admins can record in any facility.'}
                </span>
              </div>

              {/* Product Selection */}
              <div className="form-group">
                <label className="form-label">Product Item *</label>
                <select
                  className="form-select font-mono"
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      [{p.sku}] {p.product_name} (${Number(p.unit_price).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Adjustment Action if ADJUSTMENT */}
              {formData.movement_type === 'ADJUSTMENT' && (
                <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <label className="form-label">Adjustment Direction *</label>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="adj_direction"
                        value="INCREASE"
                        checked={formData.adjustment_action === 'INCREASE'}
                        onChange={() => setFormData({ ...formData, adjustment_action: 'INCREASE' })}
                      />
                      <span>Surplus / Recount (+ Add stock)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="adj_direction"
                        value="DECREASE"
                        checked={formData.adjustment_action === 'DECREASE'}
                        onChange={() => setFormData({ ...formData, adjustment_action: 'DECREASE' })}
                      />
                      <span>Damage / Shrinkage (- Deduct stock)</span>
                    </label>
                  </div>
                  <span className="form-hint">
                    Adjustment delta is transactional and validated against negative inventory limits.
                  </span>
                </div>
              )}

              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">Quantity to Move *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="e.g. 25"
                />
              </div>

              {/* Reference Number */}
              <div className="form-group">
                <label className="form-label">Reference Number (Optional)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="e.g. PO-2026-901 or DISP-402"
                />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Audit Notes & Reason (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Supplier delivery verified at dock 3"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Executing Transaction...' : 'Commit Movement'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
