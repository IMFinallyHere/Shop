from django.urls import path, include

urlpatterns = [
    path("api/", include("accounts.urls")),
    path("api/", include("inventory.urls")),
    path("api/", include("billing.urls")),
    path("api/", include("customers.urls")),
]
