const request = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, { headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...options, body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.message || 'Request failed');
  return data;
};
export const api = {
  products: () => request('/products'),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  orders: (token) => request('/orders', { token }),
  createOrder: (token, body) => request('/orders', { method: 'POST', token, body }),
  verifyPayment: (token, id, body) => request(`/orders/${id}/verify-payment`, { method: 'POST', token, body }),
  adminOrders: (token) => request('/admin/orders', { token }),
  createProduct: (token, body) => request('/admin/products', { method: 'POST', token, body }),
  updateProduct: (token, id, body) => request(`/admin/products/${id}`, { method: 'PUT', token, body }),
  uploadImage: (token, file) => { const body = new FormData(); body.append('image', file); return request('/admin/uploads', { method: 'POST', token, body }); },
  deleteProduct: (token, id) => request(`/admin/products/${id}`, { method: 'DELETE', token })
};
