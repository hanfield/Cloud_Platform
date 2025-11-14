"""
服务管理URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ServiceViewSet, ServiceSubscriptionViewSet

router = DefaultRouter()
router.register(r'services', ServiceViewSet)
router.register(r'service-subscriptions', ServiceSubscriptionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]