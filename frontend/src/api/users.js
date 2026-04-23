import api from './axiosInstance'

export const getUsers = (params) => api.get('/users/', { params })
export const getUser = (id) => api.get(`/users/${id}/`)
export const createUser = (data) => api.post('/users/', data)
export const updateUser = (id, data) => api.patch(`/users/${id}/`, data)
export const deleteUser = (id) => api.delete(`/users/${id}/`)
export const changePassword = (id, data) => api.post(`/users/${id}/change-password/`, data)
export const assignGroups = (id, groupIds) => api.post(`/users/${id}/assign-groups/`, { group_ids: groupIds })
export const assignUserPermissions = (id, permissionIds) => api.post(`/users/${id}/assign-permissions/`, { permission_ids: permissionIds })
