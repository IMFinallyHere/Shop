from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("sellers", views.SellerViewSet, basename="seller")
router.register("products", views.ProductViewSet, basename="product")
router.register("variants", views.ProductVariantViewSet, basename="variant")
router.register("stock-items", views.StockItemViewSet, basename="stockitem")

urlpatterns = router.urls
