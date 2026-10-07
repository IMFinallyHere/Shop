from django.urls import path
from rest_framework.routers import DefaultRouter

from . import search, views

router = DefaultRouter()
router.register("bills", views.BillViewSet, basename="bill")
router.register("returns", views.ReturnViewSet, basename="return")

urlpatterns = [
    path("search/", search.SearchView.as_view(), name="search"),
    path("units/<str:code>/history/", search.UnitHistoryView.as_view(), name="unit-history"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("store-credit/", views.StoreCreditView.as_view(), name="store-credit"),
] + router.urls
