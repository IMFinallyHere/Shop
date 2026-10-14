// Mirrors the backend's ShopPermission: the shop owner can do anything; staff need the
// permission ('app.codename') from their groups. 'owner' marks owner-only areas.
export const can = (user, perm) => {
  if (!user) return false
  if (user.is_superuser) return true
  if (perm == null) return true
  if (perm === 'owner' || !user.is_staff) return false
  return (user.permissions ?? []).includes(perm)
}
