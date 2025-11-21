from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Order
from .serializers import OrderSerializer

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Filter orders by the current user's tenant if applicable
        # Assuming request.user has a tenant attribute or similar logic
        # For now, returning all for admin, need to refine for tenant users
        return super().get_queryset()

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status not in ['pending', 'paid']:
             return Response({'error': 'Cannot cancel order in current status'}, status=status.HTTP_400_BAD_REQUEST)
        
        order.status = 'cancelled'
        order.save()
        return Response({'status': 'order cancelled'})
