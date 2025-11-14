"""
产品管理URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet,
    DiscountLevelViewSet,
    ProductSubscriptionViewSet,
    PricingTierViewSet
)

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'discount-levels', DiscountLevelViewSet, basename='discount-level')
router.register(r'subscriptions', ProductSubscriptionViewSet, basename='subscription')
router.register(r'pricing-tiers', PricingTierViewSet, basename='pricing-tier')

urlpatterns = [
    path('', include(router.urls)),
]