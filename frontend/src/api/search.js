import api from './axiosInstance'

export const search = (q) => api.get('/search/', { params: { q } })
export const getUnitHistory = (code) => api.get(`/units/${encodeURIComponent(code)}/history/`)
