import {
  LayoutDashboard, ScanBarcode, Receipt, Undo2, Users, Shirt, Boxes, FolderTree, Truck,
  Settings, UserCog, ShieldCheck, KeyRound,
} from 'lucide-react'

export const NAV = [
  {
    section: 'Sell',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'billing.view_bill' },
      { to: '/pos', label: 'New bill', icon: ScanBarcode, perm: 'billing.add_bill' },
      { to: '/sales', label: 'Sales', icon: Receipt, perm: 'billing.view_bill' },
      { to: '/returns', label: 'Returns', icon: Undo2, perm: 'billing.view_return' },
      { to: '/customers', label: 'Customers', icon: Users, perm: 'customers.view_customer' },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Shirt, perm: 'inventory.view_product' },
      { to: '/stock', label: 'Stock', icon: Boxes, perm: 'inventory.view_stockitem' },
      { to: '/categories', label: 'Categories', icon: FolderTree, perm: 'inventory.view_category' },
      { to: '/sellers', label: 'Sellers', icon: Truck, perm: 'inventory.view_seller' },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings, perm: 'shopsettings.change_shopsettings' },
      { to: '/users', label: 'Users', icon: UserCog, perm: 'owner' },
      { to: '/groups', label: 'Groups', icon: ShieldCheck, perm: 'owner' },
      { to: '/permissions', label: 'Permissions', icon: KeyRound, perm: 'owner' },
    ],
  },
]

export const findNavItem = (pathname) =>
  NAV.flatMap(s => s.items).find(i => pathname === i.to || pathname.startsWith(i.to + '/'))

// Pages outside the menu that still need a permission.
const EXTRA_PERMS = { '/search': 'billing.view_bill' }

// Permission needed to open `pathname` (null = anyone in the shop).
export const pagePerm = (pathname) => EXTRA_PERMS[pathname] ?? findNavItem(pathname)?.perm ?? null
