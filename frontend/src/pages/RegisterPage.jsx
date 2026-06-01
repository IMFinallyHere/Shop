import { useState } from 'react'
import { Link } from 'react-router-dom'
import { signup } from '../api/auth'

export default function RegisterPage() {
  const [form, setForm] = useState({
    shop_name: '', email: '', password: '', first_name: '', last_name: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setFieldErrors({}); setLoading(true)
    try {
      const { data } = await signup(form)
      setDone(data)
      // Redirect to the new shop's subdomain login after a short pause.
      const port = window.location.port ? `:${window.location.port}` : ''
      const url = `${window.location.protocol}//${data.domain}${port}/login`
      setTimeout(() => { window.location.href = url }, 1800)
    } catch (err) {
      const data = err.response?.data || {}
      const fields = {}
      let general = ''
      Object.entries(data).forEach(([key, val]) => {
        const msg = Array.isArray(val) ? val[0] : val
        if (['shop_name', 'email', 'password', 'first_name', 'last_name'].includes(key)) fields[key] = msg
        else general += (general ? ' ' : '') + msg
      })
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length === 0 ? 'Signup failed. Please try again.' : ''))
    } finally {
      setLoading(false)
    }
  }

  const field = (name, label, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={form[name]}
        onChange={update(name)}
        required={required}
        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${fieldErrors[name] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {fieldErrors[name] && <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Create your shop</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your shop and owner account</p>
        </div>

        {done ? (
          <div className="text-center space-y-2">
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              Shop “{done.shop}” created! Taking you to{' '}
              <span className="font-medium">{done.domain}</span>…
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {field('shop_name', 'Shop name', 'text', true)}
            {field('email', 'Email', 'email', true)}
            {field('password', 'Password', 'password', true)}
            <div className="grid grid-cols-2 gap-3">
              {field('first_name', 'First name')}
              {field('last_name', 'Last name')}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? 'Creating…' : 'Create shop'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have a shop?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
