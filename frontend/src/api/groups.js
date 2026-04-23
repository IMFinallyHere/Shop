import api from './axiosInstance'

export const getGroups = (params) => api.get('/groups/', { params })
export const getGroup = (id) => api.get(`/groups/${id}/`)
export const createGroup = (data) => api.post('/groups/', data)
export const updateGroup = (id, data) => api.patch(`/groups/${id}/`, data)
export const deleteGroup = (id) => api.delete(`/groups/${id}/`)
export const assignGroupPermissions = (id, permissionIds) => api.post(`/groups/${id}/assign-permissions/`, { permission_ids: permissionIds })
