"""
产品管理API视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import Product, DiscountLevel, ProductSubscription, PricingTier
from .serializers import (
    ProductSerializer,
    DiscountLevelSerializer,
    ProductSubscriptionSerializer,
    PricingTierSerializer,
    ProductCreateSerializer,
    DiscountLevelCreateSerializer,
    ProductSubscriptionCreateSerializer,
    PricingTierCreateSerializer
)


class ProductViewSet(viewsets.ModelViewSet):
    """产品视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['product_type', 'status', 'pricing_model']

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return Product.objects.select_related('created_by').all()

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return ProductCreateSerializer
        return ProductSerializer

    def perform_create(self, serializer):
        """创建产品"""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活产品"""
        product = self.get_object()
        product.status = Product.Status.ACTIVE
        product.save()

        return Response({
            'status': 'success',
            'message': '产品已激活'
        })

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """停用产品"""
        product = self.get_object()
        product.status = Product.Status.INACTIVE
        product.save()

        return Response({
            'status': 'success',
            'message': '产品已停用'
        })

    @action(detail=True, methods=['get'])
    def subscriptions(self, request, pk=None):
        """获取产品订阅列表"""
        product = self.get_object()
        subscriptions = product.subscriptions.all()
        serializer = ProductSubscriptionSerializer(subscriptions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def pricing_tiers(self, request, pk=None):
        """获取产品定价阶梯"""
        product = self.get_object()
        pricing_tiers = product.pricing_tiers.all()
        serializer = PricingTierSerializer(pricing_tiers, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取产品统计信息"""
        total_products = Product.objects.count()
        active_products = Product.objects.filter(status=Product.Status.ACTIVE).count()
        inactive_products = Product.objects.filter(status=Product.Status.INACTIVE).count()
        draft_products = Product.objects.filter(status=Product.Status.DRAFT).count()

        # 按产品类型统计
        product_types = {}
        for product_type in Product.ProductType.choices:
            count = Product.objects.filter(
                product_type=product_type[0],
                status=Product.Status.ACTIVE
            ).count()
            product_types[product_type[1]] = count

        # 按定价模型统计
        pricing_models = {}
        for pricing_model in Product.PricingModel.choices:
            count = Product.objects.filter(
                pricing_model=pricing_model[0],
                status=Product.Status.ACTIVE
            ).count()
            pricing_models[pricing_model[1]] = count

        return Response({
            'total_products': total_products,
            'active_products': active_products,
            'inactive_products': inactive_products,
            'draft_products': draft_products,
            'product_types': product_types,
            'pricing_models': pricing_models
        })


class DiscountLevelViewSet(viewsets.ModelViewSet):
    """折扣级别视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['customer_type', 'status']

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return DiscountLevel.objects.select_related('created_by').all()

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return DiscountLevelCreateSerializer
        return DiscountLevelSerializer

    def perform_create(self, serializer):
        """创建折扣级别"""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活折扣级别"""
        discount_level = self.get_object()
        discount_level.status = DiscountLevel.Status.ACTIVE
        discount_level.save()

        return Response({
            'status': 'success',
            'message': '折扣级别已激活'
        })

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """停用折扣级别"""
        discount_level = self.get_object()
        discount_level.status = DiscountLevel.Status.INACTIVE
        discount_level.save()

        return Response({
            'status': 'success',
            'message': '折扣级别已停用'
        })

    @action(detail=False, methods=['get'])
    def available_for_tenant(self, request):
        """获取适用于租户的折扣级别"""
        tenant_id = request.query_params.get('tenant_id')
        if not tenant_id:
            return Response({
                'status': 'error',
                'message': '需要提供租户ID'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            from ..tenants.models import Tenant
            tenant = Tenant.objects.get(id=tenant_id)

            # 根据租户类型和消费金额筛选可用的折扣级别
            discount_levels = DiscountLevel.objects.filter(
                status=DiscountLevel.Status.ACTIVE,
                customer_type=tenant.tenant_type
            )

            serializer = DiscountLevelSerializer(discount_levels, many=True)
            return Response(serializer.data)

        except Tenant.DoesNotExist:
            return Response({
                'status': 'error',
                'message': '租户不存在'
            }, status=status.HTTP_404_NOT_FOUND)


class ProductSubscriptionViewSet(viewsets.ModelViewSet):
    """产品订阅视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['tenant', 'product', 'contract', 'status']

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return ProductSubscription.objects.select_related(
            'tenant', 'product', 'contract', 'created_by'
        ).all()

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return ProductSubscriptionCreateSerializer
        return ProductSubscriptionSerializer

    def perform_create(self, serializer):
        """创建产品订阅"""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """暂停订阅"""
        subscription = self.get_object()
        subscription.status = ProductSubscription.SubscriptionStatus.SUSPENDED
        subscription.save()

        return Response({
            'status': 'success',
            'message': '订阅已暂停'
        })

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """恢复订阅"""
        subscription = self.get_object()
        subscription.status = ProductSubscription.SubscriptionStatus.ACTIVE
        subscription.save()

        return Response({
            'status': 'success',
            'message': '订阅已恢复'
        })

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """终止订阅"""
        subscription = self.get_object()
        subscription.status = ProductSubscription.SubscriptionStatus.TERMINATED
        subscription.save()

        return Response({
            'status': 'success',
            'message': '订阅已终止'
        })

    @action(detail=False, methods=['get'])
    def tenant_subscriptions(self, request):
        """获取租户的订阅列表"""
        tenant_id = request.query_params.get('tenant_id')
        if not tenant_id:
            return Response({
                'status': 'error',
                'message': '需要提供租户ID'
            }, status=status.HTTP_400_BAD_REQUEST)

        subscriptions = ProductSubscription.objects.filter(
            tenant_id=tenant_id,
            status=ProductSubscription.SubscriptionStatus.ACTIVE
        )
        serializer = ProductSubscriptionSerializer(subscriptions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取订阅统计信息"""
        total_subscriptions = ProductSubscription.objects.count()
        active_subscriptions = ProductSubscription.objects.filter(
            status=ProductSubscription.SubscriptionStatus.ACTIVE
        ).count()
        suspended_subscriptions = ProductSubscription.objects.filter(
            status=ProductSubscription.SubscriptionStatus.SUSPENDED
        ).count()
        terminated_subscriptions = ProductSubscription.objects.filter(
            status=ProductSubscription.SubscriptionStatus.TERMINATED
        ).count()

        # 按产品类型统计订阅
        subscription_by_product = {}
        for product in Product.objects.all():
            count = ProductSubscription.objects.filter(
                product=product,
                status=ProductSubscription.SubscriptionStatus.ACTIVE
            ).count()
            subscription_by_product[product.name] = count

        # 按租户统计订阅
        subscription_by_tenant = {}
        from ..tenants.models import Tenant
        for tenant in Tenant.objects.all():
            count = ProductSubscription.objects.filter(
                tenant=tenant,
                status=ProductSubscription.SubscriptionStatus.ACTIVE
            ).count()
            subscription_by_tenant[tenant.name] = count

        return Response({
            'total_subscriptions': total_subscriptions,
            'active_subscriptions': active_subscriptions,
            'suspended_subscriptions': suspended_subscriptions,
            'terminated_subscriptions': terminated_subscriptions,
            'subscription_by_product': subscription_by_product,
            'subscription_by_tenant': subscription_by_tenant
        })


class PricingTierViewSet(viewsets.ModelViewSet):
    """定价阶梯视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['product']

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return PricingTier.objects.select_related('product').all()

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return PricingTierCreateSerializer
        return PricingTierSerializer

    def perform_create(self, serializer):
        """创建定价阶梯"""
        serializer.save()

    @action(detail=False, methods=['get'])
    def calculate_price(self, request):
        """根据数量和产品计算价格"""
        product_id = request.query_params.get('product_id')
        quantity = request.query_params.get('quantity', 1)

        if not product_id:
            return Response({
                'status': 'error',
                'message': '需要提供产品ID'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = int(quantity)
            product = Product.objects.get(id=product_id)

            # 获取适用的定价阶梯
            pricing_tier = PricingTier.objects.filter(
                product=product,
                min_quantity__lte=quantity
            ).order_by('-min_quantity').first()

            if pricing_tier:
                unit_price = pricing_tier.unit_price
            else:
                unit_price = product.base_price

            total_price = unit_price * quantity

            return Response({
                'product': product.name,
                'quantity': quantity,
                'unit_price': unit_price,
                'total_price': total_price,
                'pricing_tier_used': pricing_tier is not None
            })

        except (Product.DoesNotExist, ValueError):
            return Response({
                'status': 'error',
                'message': '产品不存在或数量无效'
            }, status=status.HTTP_400_BAD_REQUEST)