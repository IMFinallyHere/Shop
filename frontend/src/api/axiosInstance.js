import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

const PUBLIC_PATHS = ['/', '/login', '/register']

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// One refresh at a time: the server rotates refresh tokens and blacklists the old one,
// so parallel 401s must share a single refresh call (a second call with the same,
// now-blacklisted token would fail and log the user out).
let refreshing = null
function refreshAccess() {
  refreshing ??= (async () => {
    const refresh = localStorage.getItem('refresh_token')
    if (!refresh) throw Object.assign(new Error('No refresh token'), { signedOut: true })
    try {
      const { data } = await axios.post('/api/auth/refresh/', { refresh })
      localStorage.setItem('access_token', data.access)
      // Rotation: keep the new refresh token, the old one no longer works.
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
      return data.access
    } catch (e) {
      // Only a rejected token means signed out; a network blip or a server restart
      // (deploys) must not throw the user out.
      const status = e.response?.status
      throw Object.assign(e, { signedOut: status === 401 || status === 400 })
    }
  })().finally(() => { refreshing = null })
  return refreshing
}

function signOut() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  // Public pages (the website, sign in, sign up) just carry on signed out.
  if (!PUBLIC_PATHS.includes(window.location.pathname)) window.location.href = '/login'
}

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/login')) {
      original._retry = true
      try {
        const access = await refreshAccess()
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch (e) {
        if (e.signedOut) signOut()
      }
    }
    return Promise.reject(error)
  }
)

export default api
