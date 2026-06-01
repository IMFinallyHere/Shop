import api from './axiosInstance'

export const lookupCustomers = (phone) => api.get('/customers/lookup/', { params: { phone } })
export const getCustomers = (params) => api.get('/customers/', { params })
