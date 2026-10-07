import api from './axiosInstance'

// Products
export const getProducts = (params) => api.get('/products/', { params })
export const createProduct = (data) => api.post('/products/', data)
export const updateProduct = (id, data) => api.patch(`/products/${id}/`, data)
export const deleteProduct = (id) => api.delete(`/products/${id}/`)
// lines: [{ color, size, quantity, cost_price, price }] — each line becomes its own priced batch
export const addStock = (id, lines) => api.post(`/products/${id}/add-stock/`, { lines })

// Variants (color + size of a product)
export const updateVariant = (id, data) => api.patch(`/variants/${id}/`, data)
export const deleteVariant = (id) => api.delete(`/variants/${id}/`)

// Stock items (individual units)
export const getStockItems = (params) => api.get('/stock-items/', { params })
export const removeStockItem = (id) => api.post(`/stock-items/${id}/remove/`)
export const lookupStockItem = (code) => api.get('/stock-items/lookup/', { params: { code } })

// Categories
export const getCategories = (params) => api.get('/categories/', { params })
export const createCategory = (data) => api.post('/categories/', data)
export const updateCategory = (id, data) => api.patch(`/categories/${id}/`, data)
export const deleteCategory = (id) => api.delete(`/categories/${id}/`)

// Sellers
export const getSellers = (params) => api.get('/sellers/', { params })
export const createSeller = (data) => api.post('/sellers/', data)
export const updateSeller = (id, data) => api.patch(`/sellers/${id}/`, data)
export const deleteSeller = (id) => api.delete(`/sellers/${id}/`)
