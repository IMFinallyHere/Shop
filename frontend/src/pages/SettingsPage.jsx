import { useEffect, useState } from 'react'
import {
  getShopSettings, updateShopSettings,
  getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  getSizes, createSize, updateSize, deleteSize,
  getColors, createColor, updateColor, deleteColor,
} from '../api/shopsettings'
import OptionList from '../components/settings/OptionList'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [savedTax, setSavedTax] = useState('')
  const [savingTax, setSavingTax] = useState(false)
  const [methods, setMethods] = useState([])
  const [newMethod, setNewMethod] = useState('')
  const [sizes, setSizes] = useState([])
  const [colors, setColors] = useState([])

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [s, m, sz, c] = await Promise.all([getShopSettings(), getPaymentMethods(), getSizes(), getColors()])
      setTaxRate(s.data.default_tax_rate); setSavedTax(s.data.default_tax_rate)
      setMethods(m.data.results ?? m.data)
      setSizes(sz.data); setColors(c.data)
    } catch { setError('Failed to load settings.') }
    finally { setLoading(false) }
  }

  const saveTax = async () => {
    setSavingTax(true); setError('')
    try {
      const { data } = await updateShopSettings({ default_tax_rate: taxRate || 0 })
      setSavedTax(data.default_tax_rate); setTaxRate(data.default_tax_rate)
    } catch { setError('Failed to save tax rate.') }
    finally { setSavingTax(false) }
  }

  const refreshMethods = () => getPaymentMethods().then(m => setMethods(m.data.results ?? m.data))

  const addMethod = async () => {
    const name = newMethod.trim()
    if (!name) return
    try { await createPaymentMethod({ name }); setNewMethod(''); refreshMethods() }
    catch (e) { setError(e.response?.data?.name?.[0] || 'Failed to add method.') }
  }
  const toggleMethod = async (m) => { await updatePaymentMethod(m.id, { is_active: !m.is_active }); refreshMethods() }
  const removeMethod = async (m) => { await deletePaymentMethod(m.id); refreshMethods() }

  const refreshSizes = () => getSizes().then(r => setSizes(r.data))
  const refreshColors = () => getColors().then(r => setColors(r.data))
  const sizeApi = { create: createSize, update: updateSize, remove: deleteSize }
  const colorApi = { create: createColor, update: updateColor, remove: deleteColor }

  if (loading) return <Spinner />

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Shop Settings</h1>
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1">Default tax (GST)</h2>
        <p className="text-sm text-gray-500 mb-3">Applied automatically to every bill. Cashiers can't change this at the counter.</p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input type="number" min="0" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
          </div>
          <button onClick={saveTax} disabled={savingTax || taxRate === savedTax}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{savingTax ? 'Saving…' : 'Save'}</button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1">Sizes</h2>
        <p className="text-sm text-gray-500 mb-3">
          Offered when adding stock, in this order. Renaming updates every product that uses it;
          sizes in use can be deactivated but not deleted.
        </p>
        <OptionList items={sizes} api={sizeApi} onChange={refreshSizes} onError={setError} placeholder="Add a size (e.g. 4XL, 32)" />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1">Colors</h2>
        <p className="text-sm text-gray-500 mb-3">
          Offered when adding stock. Renaming updates every product that uses it;
          colors in use can be deactivated but not deleted.
        </p>
        <OptionList items={colors} api={colorApi} onChange={refreshColors} onError={setError} placeholder="Add a color (e.g. Maroon)" withHex />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">Payment methods</h2>
        <p className="text-sm text-gray-500 mb-3">Methods offered at checkout. Disable instead of deleting to keep them off new bills.</p>
        <div className="space-y-2 mb-4">
          {methods.map(m => (
            <div key={m.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <span className={`text-sm ${m.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{m.name}</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={m.is_active} onChange={() => toggleMethod(m)} className="w-4 h-4 text-indigo-600" />
                  Active
                </label>
                <button onClick={() => removeMethod(m)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
              </div>
            </div>
          ))}
          {methods.length === 0 && <p className="text-sm text-gray-400">No payment methods.</p>}
        </div>
        <div className="flex gap-2">
          <input value={newMethod} onChange={e => setNewMethod(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMethod()}
            placeholder="Add a method (e.g. Paytm)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button onClick={addMethod} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm">Add</button>
        </div>
      </section>
    </div>
  )
}
