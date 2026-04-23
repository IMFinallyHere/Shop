import api from './axiosInstance'

export const getPermissions = () => api.get('/permissions/')
