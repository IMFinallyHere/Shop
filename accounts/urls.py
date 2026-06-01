from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register('users', views.UserViewSet, basename='user')
router.register('groups', views.GroupViewSet, basename='group')
router.register('permissions', views.PermissionViewSet, basename='permission')

urlpatterns = [
    path('auth/signup/', views.SignupView.as_view(), name='signup'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/my-shops/', views.MyShopsView.as_view(), name='my-shops'),
    path('admin/tenants/', views.AdminTenantsView.as_view(), name='admin-tenants'),
    path('admin/tenants/<slug:slug>/users/', views.AdminTenantUsersView.as_view(), name='admin-tenant-users'),
] + router.urls
