import api from './axiosInstance'
import axios from 'axios'

export const login = (username, password) =>
  axios.post('/api/auth/login/', { username, password })

export const logout = (refresh) =>
  api.post('/auth/logout/', { refresh })

export const getMe = () =>
  api.get('/auth/me/')
