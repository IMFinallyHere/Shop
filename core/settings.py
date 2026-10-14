import sys
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv


BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", cast=bool, default=False)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=Csv())

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Multi-tenancy (django-tenants + django-tenant-users) -------------------
# SHARED_APPS live in the public schema (tenant registry + global user identity).
# TENANT_APPS are installed into every per-shop schema (auth groups/permissions
# and per-tenant permission rows). Apps that appear in both are intentional:
# the public schema also needs auth/permissions for the public ("system") tenant.
SHARED_APPS = [
    "django_tenants",
    "tenant_users.permissions",
    "tenant_users.tenants",
    "tenants",            # Tenant + Domain models (public schema)
    "accounts",           # global User profile (public schema)
    "customers",          # global shared Customer table (public schema)
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.postgres",   # GIN trigram indexes for search
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
]

TENANT_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "tenant_users.permissions",
    "inventory",
    "billing",
    "shopsettings",
]

INSTALLED_APPS = list(SHARED_APPS) + [
    app for app in TENANT_APPS if app not in SHARED_APPS
]

TENANT_MODEL = "tenants.Tenant"
TENANT_DOMAIN_MODEL = "tenants.Domain"
# Base domain used by tenant_users' provision_tenant helper: <slug>.<this>
TENANT_USERS_DOMAIN = config("TENANT_USERS_DOMAIN", default="localhost")

AUTHENTICATION_BACKENDS = [
    "tenant_users.permissions.backend.UserBackend",
]

MIDDLEWARE = [
    # TenantMainMiddleware must run first: it resolves the active schema from
    # the request host before anything touches the database.
    "django_tenants.middleware.main.TenantMainMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    # No AuthenticationMiddleware/SessionMiddleware: this is a stateless DRF API;
    # JWTAuthentication populates request.user per request.
]

ROOT_URLCONF = "core.urls"

TEMPLATES = []

WSGI_APPLICATION = "core.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD", default=""),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        # Reuse connections across requests instead of reconnecting every time.
        "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", cast=int, default=60),
        "CONN_HEALTH_CHECKS": True,
    }
}

DATABASE_ROUTERS = ["django_tenants.routers.TenantSyncRouter"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

USE_TZ = True
# Shops are in India; "today" on the dashboard and date grouping use local time.
TIME_ZONE = "Asia/Kolkata"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    # JSON only: the browsable HTML renderer needs templates this API doesn't ship.
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    # Per-client limits on the unauthenticated endpoints (password guessing, mass
    # signups). nginx enforces the same limits across all workers in production.
    "DEFAULT_THROTTLE_RATES": {
        "login": config("THROTTLE_LOGIN", default="10/min"),
        "signup": config("THROTTLE_SIGNUP", default="5/hour"),
    },
    # Behind nginx: the client's IP is the last X-Forwarded-For hop it adds.
    "NUM_PROXIES": config("NUM_PROXIES", cast=int, default=0),
}
# The test suite logs in far more often than any real client.
if "test" in sys.argv:
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {"login": "10000/min", "signup": "10000/min"}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Frontend is served per-shop on subdomains in dev (e.g. acme.localhost:5173)
# plus the bare main domain for the signup/landing page. In production nginx serves
# the frontend and /api from the same host, so no cross-origin access is needed.
CORS_ALLOWED_ORIGIN_REGEXES = config(
    "CORS_ALLOWED_ORIGIN_REGEXES", cast=Csv(), default=r"^http://([a-z0-9-]+\.)?localhost:5173$"
)
CORS_ALLOW_CREDENTIALS = True

# --- Production (behind nginx, HTTPS terminated there) ----------------------
# nginx sets X-Forwarded-Proto; trust it so request.is_secure() is right.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# Errors go to stderr, which systemd captures in journald.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {"django": {"handlers": ["console"], "level": "INFO", "propagate": False}},
}
