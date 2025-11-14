"""
用户管理视图
"""

import logging
import json
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .user_models import UserProfile
from .user_serializers import (
    UserProfileSerializer, UserRegisterSerializer, UserCreateSerializer,
    UserUpdateSerializer, UserPasswordResetSerializer, UserListSerializer
)

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def user_register(request):
    """
    用户注册接口（公开）
    租户用户自助注册，注册后状态为待审核
    使用Django原生视图，完全绕过DRF认证
    """
    try:
        data = json.loads(request.body)
        serializer = UserRegisterSerializer(data=data)

        if serializer.is_valid():
            profile = serializer.save()
            logger.info(f"新用户注册: {profile.user.username}, 租户: {profile.tenant.name}")
            return JsonResponse({
                'detail': '注册成功，请等待管理员审核',
                'username': profile.user.username,
                'status': profile.status
            }, status=201)

        return JsonResponse(serializer.errors, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的JSON数据'}, status=400)
    except Exception as e:
        logger.error(f"注册失败: {str(e)}")
        return JsonResponse({'detail': str(e)}, status=500)


class UserProfileViewSet(viewsets.ModelViewSet):
    """用户管理视图集"""

    queryset = UserProfile.objects.select_related('user', 'tenant').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__username', 'user__email', 'phone', 'tenant__name']
    ordering_fields = ['created_at', 'user__username', 'user_type', 'status']
    ordering = ['-created_at']

    filterset_fields = {
        'user_type': ['exact'],
        'status': ['exact'],
        'tenant': ['exact'],
        'created_at': ['gte', 'lte'],
    }

    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        elif self.action == 'list':
            return UserListSerializer
        return UserProfileSerializer

    def get_queryset(self):
        """根据用户类型过滤数据"""
        queryset = super().get_queryset()
        user = self.request.user

        try:
            profile = user.profile
            if profile.is_tenant_user:
                queryset = queryset.filter(tenant=profile.tenant)
        except UserProfile.DoesNotExist:
            pass

        return queryset

    def perform_create(self, serializer):
        """创建用户"""
        profile = serializer.save()
        logger.info(f"管理员 {self.request.user.username} 创建了用户 {profile.user.username}")

    def perform_update(self, serializer):
        """更新用户"""
        profile = serializer.save()
        logger.info(f"管理员 {self.request.user.username} 更新了用户 {profile.user.username}")

    def perform_destroy(self, instance):
        """删除用户"""
        username = instance.user.username
        instance.user.delete()
        logger.info(f"管理员 {self.request.user.username} 删除了用户 {username}")

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """审核通过用户"""
        profile = self.get_object()

        if profile.status != UserProfile.UserStatus.PENDING:
            return Response(
                {'detail': '该用户不是待审核状态'},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile.status = UserProfile.UserStatus.ACTIVE
        profile.user.is_active = True
        profile.save()
        profile.user.save()

        logger.info(f"管理员 {request.user.username} 审核通过了用户 {profile.user.username}")
        return Response({'detail': '用户已审核通过'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒绝用户注册"""
        profile = self.get_object()

        if profile.status != UserProfile.UserStatus.PENDING:
            return Response(
                {'detail': '该用户不是待审核状态'},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile.status = UserProfile.UserStatus.REJECTED
        profile.user.is_active = False
        profile.save()
        profile.user.save()

        logger.info(f"管理员 {request.user.username} 拒绝了用户 {profile.user.username}")
        return Response({'detail': '用户注册已拒绝'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活用户"""
        profile = self.get_object()
        profile.status = UserProfile.UserStatus.ACTIVE
        profile.user.is_active = True
        profile.save()
        profile.user.save()

        logger.info(f"管理员 {request.user.username} 激活了用户 {profile.user.username}")
        return Response({'detail': '用户已激活'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """暂停用户"""
        profile = self.get_object()
        profile.status = UserProfile.UserStatus.SUSPENDED
        profile.user.is_active = False
        profile.save()
        profile.user.save()

        logger.info(f"管理员 {request.user.username} 暂停了用户 {profile.user.username}")
        return Response({'detail': '用户已暂停'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """重置用户密码"""
        profile = self.get_object()
        serializer = UserPasswordResetSerializer(data=request.data)

        if serializer.is_valid():
            profile.user.set_password(serializer.validated_data['new_password'])
            profile.user.save()

            logger.info(f"管理员 {request.user.username} 重置了用户 {profile.user.username} 的密码")
            return Response({'detail': '密码重置成功'}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取用户统计信息"""
        queryset = self.get_queryset()

        total_count = queryset.count()
        admin_count = queryset.filter(user_type=UserProfile.UserType.ADMIN).count()
        tenant_count = queryset.filter(user_type=UserProfile.UserType.TENANT).count()

        active_count = queryset.filter(status=UserProfile.UserStatus.ACTIVE).count()
        pending_count = queryset.filter(status=UserProfile.UserStatus.PENDING).count()
        suspended_count = queryset.filter(status=UserProfile.UserStatus.SUSPENDED).count()
        rejected_count = queryset.filter(status=UserProfile.UserStatus.REJECTED).count()

        stats_data = {
            'total_count': total_count,
            'admin_count': admin_count,
            'tenant_count': tenant_count,
            'active_count': active_count,
            'pending_count': pending_count,
            'suspended_count': suspended_count,
            'rejected_count': rejected_count,
        }

        return Response(stats_data)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """获取当前用户信息"""
        try:
            profile = request.user.profile
            serializer = UserProfileSerializer(profile)
            return Response(serializer.data)
        except UserProfile.DoesNotExist:
            return Response(
                {'detail': '用户配置不存在'},
                status=status.HTTP_404_NOT_FOUND
            )