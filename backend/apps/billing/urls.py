from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MonthlyBillViewSet, BillItemViewSet, PaymentViewSet

router = DefaultRouter()
router.register(r'monthly-bills', MonthlyBillViewSet)
router.register(r'bill-items', BillItemViewSet)
router.register(r'payments', PaymentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
