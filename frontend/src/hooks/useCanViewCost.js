import { useAuth } from '../contexts/AuthContext'
import { can } from '../utils/permissions'

// Cost prices are shown (and entered) only with this permission; the API leaves them out otherwise.
export const COST_PERM = 'inventory.view_cost_price'

export default function useCanViewCost() {
  const { user } = useAuth()
  return can(user, COST_PERM)
}
