import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import DashboardLayout from './components/layout/DashboardLayout'
import LoginPage from './pages/LoginPage'
import Spinner from './components/common/Spinner'
import { homePath } from './utils/domain'

// Pages load on demand so the first visit only downloads the route it needs.
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ShopPickerPage = lazy(() => import('./pages/ShopPickerPage'))
const PlatformAdminPage = lazy(() => import('./pages/PlatformAdminPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const StockPage = lazy(() => import('./pages/StockPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const SellersPage = lazy(() => import('./pages/SellersPage'))
const POSPage = lazy(() => import('./pages/POSPage'))
const SalesPage = lazy(() => import('./pages/SalesPage'))
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const GroupsPage = lazy(() => import('./pages/GroupsPage'))
const PermissionsPage = lazy(() => import('./pages/PermissionsPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const StockUnitPage = lazy(() => import('./pages/StockUnitPage'))
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage'))

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner className="h-screen" />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<Spinner className="h-screen" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          {/* Main-domain pages (no shop context) */}
          <Route path="/shops" element={<ShopPickerPage />} />
          <Route path="/admin" element={<PlatformAdminPage />} />
          {/* Shop-subdomain pages */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/stock/:code" element={<StockUnitPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/sellers" element={<SellersPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/permissions" element={<PermissionsPage />} />
          </Route>
          <Route path="/" element={<Navigate to={homePath()} replace />} />
          <Route path="*" element={<Navigate to={homePath()} replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
