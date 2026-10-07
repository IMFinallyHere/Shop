import api from './axiosInstance'

export const checkout = (data) => api.post('/bills/', data)
export const getBills = (params) => api.get('/bills/', { params })
export const getBill = (id) => api.get(`/bills/${id}/`)
export const findBillByCode = (code) => api.get('/bills/by-code/', { params: { code } })

export const createReturn = (data) => api.post('/returns/', data)
export const getReturns = (params) => api.get('/returns/', { params })
export const getReturn = (id) => api.get(`/returns/${id}/`)

export const getStoreCredit = (phone) => api.get('/store-credit/', { params: { phone } })
