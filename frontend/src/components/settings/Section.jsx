import { Card } from '../ui/Card'

// A titled settings card.
export default function Section({ title, description, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-zinc-500">{description}</p>}
      {children}
    </Card>
  )
}
