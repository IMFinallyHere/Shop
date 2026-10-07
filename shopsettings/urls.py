from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("payment-methods", views.PaymentMethodViewSet, basename="paymentmethod")
router.register("sizes", views.SizeViewSet, basename="size")
router.register("colors", views.ColorViewSet, basename="color")

urlpatterns = [
    path("shop-settings/", views.ShopSettingsView.as_view(), name="shop-settings"),
] + router.urls
