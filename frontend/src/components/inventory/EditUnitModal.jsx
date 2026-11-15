import { useEffect, useState } from 'react'
import { getColors, getSizes } from '../../api/shopsettings'
import { editStockItem } from '../../api/inventory'
import Modal from '../common/Modal'
import ErrorAlert from '../common/ErrorAlert'
import Button from '../ui/Button'
import { Checkbox, Field, Select } from '../ui/Field'
import { useToast } from '../ui/Toast'

// Fix a unit's colour/size. `unit` = { id, code, color, size, color_name, size_name }.
// Optionally applies to every unit that was added in the same batch.
export default function EditUnitModal({ unit, onClose, onSaved }) {
  // Remount per unit so the form state starts from that unit's values.
  return <EditUnitForm key={unit?.id ?? 'none'} unit={unit} onClose={onClose} onSaved={onSaved} />
}

function EditUnitForm({ unit, onClose, onSaved }) {
  const toast = useToast()
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [color, setColor] = useState(unit?.color ? String(unit.color) : '')
  const [size, setSize] = useState(unit?.size ? String(unit.size) : '')
  const [wholeBatch, setWholeBatch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!unit) return
    getColors({ active: 1 }).then(r => setColors(r.data)).catch(() => setError('Failed to load colors.'))
    getSizes({ active: 1 }).then(r => setSizes(r.data)).catch(() => setError('Failed to load sizes.'))
  }, [unit])

  // Keep the unit's current (maybe deactivated) option selectable.
  const withCurrent = (options, id, name) => (id && !options.some(o => o.id === id) ? [...options, { id, name }] : options)
  const colorOptions = withCurrent(colors, unit?.color, unit?.color_name)
  const sizeOptions = withCurrent(sizes, unit?.size, unit?.size_name)
  const unchanged = String(unit?.color ?? '') === color && String(unit?.size ?? '') === size

  const save = async () => {
    setSaving(true); setError('')
    try {
      await editStockItem(unit.id, { color: color || null, size: size || null, apply_to: wholeBatch ? 'batch' : 'unit' })
      toast(wholeBatch ? 'Batch updated' : `Unit ${unit.code} updated`)
      onSaved?.(); onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update the unit.')
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen={!!unit} onClose={onClose} title="Edit unit" description={`Change the colour or size of ${unit?.code ?? ''}. The barcode stays the same.`}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} loading={saving} disabled={unchanged}>Save</Button>
      </>}>
      <ErrorAlert message={error} onDismiss={() => setError('')} />
      <div className="space-y-4">
        <Field label="Color">
          {id => (
            <Select id={id} value={color} onChange={e => setColor(e.target.value)}>
              <option value="">No color</option>
              {colorOptions.map(o => <option key={o.id} value={o.id} data-hex={/multi/i.test(o.name) ? 'multi' : o.hex || ''}>{o.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Size">
          {id => (
            <Select id={id} value={size} onChange={e => setSize(e.target.value)}>
              <option value="">No size</option>
              {sizeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          )}
        </Field>
        <Checkbox label="Apply to all units in this batch" description="Otherwise only this one unit changes."
          checked={wholeBatch} onChange={e => setWholeBatch(e.target.checked)} />
      </div>
    </Modal>
  )
}
