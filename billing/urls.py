from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("bills", views.BillViewSet, basename="bill")
router.register("returns", views.ReturnViewSet, basename="return")

urlpatterns = [
    path("store-credit/", views.StoreCreditView.as_view(), name="store-credit"),
] + router.urls
