import api from './axiosInstance'

export const getShopSettings = () => api.get('/shop-settings/')
export const updateShopSettings = (data) => api.put('/shop-settings/', data)

export const getPaymentMethods = (params) => api.get('/payment-methods/', { params })
export const createPaymentMethod = (data) => api.post('/payment-methods/', data)
export const updatePaymentMethod = (id, data) => api.patch(`/payment-methods/${id}/`, data)
export const deletePaymentMethod = (id) => api.delete(`/payment-methods/${id}/`)

// Sizes & colors (product variants reference these). Unpaginated lists.
export const getSizes = (params) => api.get('/sizes/', { params })
export const createSize = (data) => api.post('/sizes/', data)
export const updateSize = (id, data) => api.patch(`/sizes/${id}/`, data)
export const deleteSize = (id) => api.delete(`/sizes/${id}/`)

export const getColors = (params) => api.get('/colors/', { params })
export const createColor = (data) => api.post('/colors/', data)
export const updateColor = (id, data) => api.patch(`/colors/${id}/`, data)
export const deleteColor = (id) => api.delete(`/colors/${id}/`)
