from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MonitoringViewSet

router = DefaultRouter()
router.register(r'', MonitoringViewSet, basename='monitoring')

urlpatterns = [
    path('', include(router.urls)),
]
