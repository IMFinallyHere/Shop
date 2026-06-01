from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("bills", views.BillViewSet, basename="bill")

urlpatterns = router.urls
