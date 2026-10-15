import { useState } from 'react'
import { signup } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { shopUrl, shopUrlWithTokens } from '../utils/domain'

const FIELDS = ['shop_name', 'email', 'password', 'first_name', 'last_name']

// Signup → sign in → open the new shop's dashboard (tokens travel in the URL hash).
export default function useCreateShop() {
  const { login } = useAuth()
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  const createShop = async (form) => {
    setError(''); setFieldErrors({}); setLoading(true)
    let data
    try {
      ({ data } = await signup(form))
    } catch (err) {
      const data = err.response?.data || {}
      if (err.response?.status === 429) {
        setError('Too many attempts from this network. Try again in a little while.')
      } else {
        const fields = {}
        let general = ''
        Object.entries(data).forEach(([key, val]) => {
          const msg = Array.isArray(val) ? val.join(' ') : val
          if (FIELDS.includes(key)) fields[key] = msg
          else general += (general ? ' ' : '') + msg
        })
        setFieldErrors(fields)
        setError(general || (Object.keys(fields).length ? '' : 'Your shop could not be created. Try again.'))
      }
      setLoading(false)
      return
    }
    setCreated(data)
    try {
      await login(form.email, form.password)
      window.location.assign(shopUrlWithTokens(data.domain))
    } catch {
      // The shop exists; if signing in here fails, sign in on the shop itself.
      window.location.assign(shopUrl(data.domain, '/login'))
    }
  }

  return { createShop, fieldErrors, error, loading, created }
}
