import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, login as apiLogin, logout as apiLogout } from '../api/auth'

const AuthContext = createContext(null)

// Tokens handed off from the shop picker arrive in the URL hash (cross-origin): store them
// and clean the address bar. Safe to run twice (the hash is gone the second time).
function takeHandoffTokens() {
  const hash = window.location.hash
  if (!hash.includes('access=')) return
  const params = new URLSearchParams(hash.slice(1))
  const access = params.get('access')
  const refresh = params.get('refresh')
  if (access) {
    localStorage.setItem('access_token', access)
    if (refresh) localStorage.setItem('refresh_token', refresh)
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Only "loading" when there is a token to check; decided before the first render.
  const [isLoading, setIsLoading] = useState(() => {
    takeHandoffTokens()
    return !!localStorage.getItem('access_token')
  })

  useEffect(() => {
    if (!localStorage.getItem('access_token')) return
    getMe()
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await apiLogin(email, password)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    // /auth/me/ also carries the current shop's name; fall back to the login payload.
    const me = await getMe().then(r => r.data).catch(() => null)
    setUser(me ?? data.user)
  }

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token')
    try {
      await apiLogout(refresh)
    } catch {
      // blacklist best-effort
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
