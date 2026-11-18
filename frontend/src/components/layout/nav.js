import {
  LayoutDashboard, ScanBarcode, Receipt, Undo2, Users, Shirt, Boxes, FolderTree, Truck,
  Settings, UserCog, ShieldCheck, KeyRound, HandCoins, ClipboardList,
} from 'lucide-react'

export const NAV = [
  {
    section: 'Sell',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'billing.view_dashboard' },
      { to: '/pos', label: 'New bill', icon: ScanBarcode, perm: 'billing.add_bill', shortcut: 'N' },
      { to: '/sales', label: 'Sales', icon: Receipt, perm: 'billing.view_bill' },
      { to: '/returns', label: 'Returns', icon: Undo2, perm: 'billing.view_return' },
      { to: '/customers', label: 'Customers', icon: Users, perm: 'customers.view_customer' },
      { to: '/credit', label: 'Credit', icon: HandCoins, perm: 'billing.view_duepayment' },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Shirt, perm: 'inventory.view_product', end: true },
      { to: '/products/missing', label: 'Missing details', icon: ClipboardList, perm: 'inventory.change_product', badge: 'missing' },
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

// Longest match wins, so /products/missing is "Missing details", not "Products".
export const findNavItem = (pathname) =>
  NAV.flatMap(s => s.items)
    .filter(i => pathname === i.to || pathname.startsWith(i.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0]

// Pages outside the menu that still need a permission.
const EXTRA_PERMS = { '/search': 'billing.view_bill' }

// Permission needed to open `pathname` (null = anyone in the shop).
export const pagePerm = (pathname) => EXTRA_PERMS[pathname] ?? findNavItem(pathname)?.perm ?? null
