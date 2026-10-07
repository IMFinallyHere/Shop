import api from './axiosInstance'

export const getDashboard = () => api.get('/dashboard/')
