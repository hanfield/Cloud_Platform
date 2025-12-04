from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MonitoringViewSet, AlertRuleViewSet, AlertHistoryViewSet

router = DefaultRouter()
router.register(r'alert-rules', AlertRuleViewSet, basename='alert-rules')
router.register(r'alert-history', AlertHistoryViewSet, basename='alert-history')
router.register(r'', MonitoringViewSet, basename='monitoring')

urlpatterns = [
    path('', include(router.urls)),
]
