import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import DashboardLayout from './components/layout/DashboardLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ShopPickerPage from './pages/ShopPickerPage'
import PlatformAdminPage from './pages/PlatformAdminPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import StockPage from './pages/StockPage'
import CategoriesPage from './pages/CategoriesPage'
import SellersPage from './pages/SellersPage'
import POSPage from './pages/POSPage'
import SalesPage from './pages/SalesPage'
import ReturnsPage from './pages/ReturnsPage'
import CustomersPage from './pages/CustomersPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import GroupsPage from './pages/GroupsPage'
import PermissionsPage from './pages/PermissionsPage'
import SearchPage from './pages/SearchPage'
import StockUnitPage from './pages/StockUnitPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import Spinner from './components/common/Spinner'
import { homePath } from './utils/domain'

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner className="h-screen" />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
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
