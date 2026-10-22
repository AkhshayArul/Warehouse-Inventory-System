const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-expired'));
    }
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  // Authentication
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  getCurrentUser: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Warehouses
  getWarehouses: async (assignedOnly = false) => {
    const url = `${API_BASE}/warehouses${assignedOnly ? '?assigned_only=true' : ''}`;
    const res = await fetch(url, { headers: getAuthHeader() });
    return handleResponse(res);
  },

  createWarehouse: async (data) => {
    const res = await fetch(`${API_BASE}/warehouses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateWarehouse: async (id, data) => {
    const res = await fetch(`${API_BASE}/warehouses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  deleteWarehouse: async (id) => {
    const res = await fetch(`${API_BASE}/warehouses/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Users (Admin only)
  getUsers: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  createUser: async (data) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateUser: async (id, data) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  deleteUser: async (id) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Products
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/products?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  getProductDetails: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  createProduct: async (data) => {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  updateProduct: async (id, data) => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  deleteProduct: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  // Inventory (using VIEW `vw_inventory_details` & Stored Procedure `sp_get_warehouse_inventory_summary`)
  getInventory: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/inventory?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  getInventorySummary: async (warehouseId = null) => {
    const url = warehouseId ? `${API_BASE}/inventory/summary?warehouse_id=${warehouseId}` : `${API_BASE}/inventory/summary`;
    const res = await fetch(url, { headers: getAuthHeader() });
    return handleResponse(res);
  },

  // Stock Movements (Transactions)
  getMovements: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/movements?${params.toString()}`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  },

  recordMovement: async (data) => {
    const res = await fetch(`${API_BASE}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Reports
  getDashboardReport: async () => {
    const res = await fetch(`${API_BASE}/reports/dashboard`, {
      headers: getAuthHeader()
    });
    return handleResponse(res);
  }
};
