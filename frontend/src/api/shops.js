import api from './axiosInstance'

export const getMyShops = () => api.get('/auth/my-shops/')
export const getAdminTenants = () => api.get('/admin/tenants/')
export const getTenantUsers = (slug) => api.get(`/admin/tenants/${slug}/users/`)
