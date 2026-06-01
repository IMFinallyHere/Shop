import api from './axiosInstance'
import axios from 'axios'

export const login = (email, password) =>
  axios.post('/api/auth/login/', { email, password })

export const signup = (data) =>
  axios.post('/api/auth/signup/', data)

export const logout = (refresh) =>
  api.post('/auth/logout/', { refresh })

export const getMe = () =>
  api.get('/auth/me/')
