import api from './axiosInstance'

export const getShopSettings = () => api.get('/shop-settings/')
export const updateShopSettings = (data) => api.put('/shop-settings/', data)

export const getPaymentMethods = (params) => api.get('/payment-methods/', { params })
export const createPaymentMethod = (data) => api.post('/payment-methods/', data)
export const updatePaymentMethod = (id, data) => api.patch(`/payment-methods/${id}/`, data)
export const deletePaymentMethod = (id) => api.delete(`/payment-methods/${id}/`)
