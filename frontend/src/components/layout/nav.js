import {
  LayoutDashboard, ScanBarcode, Receipt, Undo2, Users, Shirt, Boxes, FolderTree, Truck,
  Settings, UserCog, ShieldCheck, KeyRound,
} from 'lucide-react'

export const NAV = [
  {
    section: 'Sell',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/pos', label: 'New bill', icon: ScanBarcode },
      { to: '/sales', label: 'Sales', icon: Receipt },
      { to: '/returns', label: 'Returns', icon: Undo2 },
      { to: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Shirt },
      { to: '/stock', label: 'Stock', icon: Boxes },
      { to: '/categories', label: 'Categories', icon: FolderTree },
      { to: '/sellers', label: 'Sellers', icon: Truck },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/users', label: 'Users', icon: UserCog },
      { to: '/groups', label: 'Groups', icon: ShieldCheck },
      { to: '/permissions', label: 'Permissions', icon: KeyRound },
    ],
  },
]

export const findNavItem = (pathname) =>
  NAV.flatMap(s => s.items).find(i => pathname === i.to || pathname.startsWith(i.to + '/'))
