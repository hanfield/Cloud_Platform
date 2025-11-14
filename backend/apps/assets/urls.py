from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PhysicalAssetViewSet, AssetUsageHistoryViewSet,
    MaintenanceContractViewSet, AssetMaintenanceViewSet,
    MaintenanceRecordViewSet, IntangibleAssetViewSet
)

router = DefaultRouter()
router.register(r'physical-assets', PhysicalAssetViewSet, basename='physical-asset')
router.register(r'usage-history', AssetUsageHistoryViewSet, basename='usage-history')
router.register(r'maintenance-contracts', MaintenanceContractViewSet, basename='maintenance-contract')
router.register(r'asset-maintenance', AssetMaintenanceViewSet, basename='asset-maintenance')
router.register(r'maintenance-records', MaintenanceRecordViewSet, basename='maintenance-record')
router.register(r'intangible-assets', IntangibleAssetViewSet, basename='intangible-asset')

urlpatterns = [
    path('', include(router.urls)),
]
