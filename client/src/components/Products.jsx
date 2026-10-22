import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Products({ user }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    product_name: '',
    sku: '',
    category: '',
    description: '',
    unit_price: '0.00',
    reorder_level: '10'
  });

  const canEdit = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (searchTerm) filters.search = searchTerm;
      if (selectedCategory) filters.category = selectedCategory;

      const data = await api.getProducts(filters);
      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message || 'Failed to load products catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadProducts();
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      product_name: '',
      sku: '',
      category: '',
      description: '',
      unit_price: '0.00',
      reorder_level: '10'
    });
    setIsModalOpen(true);
    setError('');
    setSuccess('');
  };

  const handleOpenEditModal = (p) => {
    setEditingProduct(p);
    setFormData({
      product_name: p.product_name,
      sku: p.sku,
      category: p.category,
      description: p.description || '',
      unit_price: String(p.unit_price),
      reorder_level: String(p.reorder_level)
    });
    setIsModalOpen(true);
    setError('');
    setSuccess('');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.product_id, formData);
        setSuccess(`Product '${formData.product_name}' updated successfully.`);
      } else {
        await api.createProduct(formData);
        setSuccess(`Product '${formData.product_name}' created successfully.`);
      }
      setIsModalOpen(false);
      loadProducts();
    } catch (err) {
      setError(err.message || 'Operation failed.');
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to delete product "${productName}"? This action will check database constraints.`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await api.deleteProduct(productId);
      setSuccess(`Product "${productName}" removed safely.`);
      loadProducts();
    } catch (err) {
      setError(err.message || 'Failed to delete product.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Product Catalog</h1>
          <p className="page-subtitle">Master records of warehouse items, SKUs, pricing, and reorder levels</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadProducts}>🔄 Refresh</button>
          {canEdit && (
            <button className="btn btn-primary" onClick={handleOpenCreateModal}>+ Add Product</button>
          )}
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
            placeholder="Search products by title, SKU, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

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

          <button type="submit" className="btn btn-secondary btn-sm">Search</button>
          {(searchTerm || selectedCategory) && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
              }}
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Unit Price</th>
                <th>Reorder Level</th>
                <th>Global Stock</th>
                <th>Description</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} style={{ textAlign: 'center', padding: '32px' }}>
                    Loading product catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} style={{ textAlign: 'center', padding: '32px' }}>
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.product_id}>
                    <td><code className="font-mono"><strong>{p.sku}</strong></code></td>
                    <td><strong>{p.product_name}</strong></td>
                    <td>{p.category}</td>
                    <td>${Number(p.unit_price).toFixed(2)}</td>
                    <td>{p.reorder_level} units</td>
                    <td>
                      <strong>{p.total_global_stock}</strong> units
                    </td>
                    <td style={{ maxWidth: '240px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {p.description || '-'}
                    </td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEditModal(p)}
                          >
                            Edit
                          </button>
                          {canDelete && (
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDeleteProduct(p.product_id, p.product_name)}
                              title="Delete product (checks foreign key and movement constraints)"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Edit/Create Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingProduct ? `Edit Product: ${editingProduct.sku}` : 'Add New Product'}
              </h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="e.g. Heavy Duty Packing Tape"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">SKU (Unique identifier) *</label>
                    <input
                      type="text"
                      className="form-input font-mono"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      placeholder="e.g. PKG-TAP-004"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      list="categories-list"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Packaging"
                    />
                    <datalist id="categories-list">
                      {categories.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Unit Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      required
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reorder Level (Alert threshold) *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      required
                      value={formData.reorder_level}
                      onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide details about specifications, dimensions, packaging..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
