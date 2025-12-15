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
from .models import Stakeholder

logger = logging.getLogger(__name__)


def is_admin_user(user):
    """检查用户是否是管理员"""
    try:
        return user.is_superuser or user.profile.user_type == 'admin'
    except:
        return False


def sync_user_to_stakeholder(profile):
    """
    同步用户到干系人列表
    - 已激活(active)状态：添加到干系人列表
    - 已暂停(suspended)状态：保留在干系人列表（已经是干系人则不处理）
    - 待审核(pending)和已拒绝(rejected)状态：从干系人列表移除
    """
    if not profile.tenant:
        return

    # 查找是否已存在对应的干系人记录
    # 通过notes字段中的用户名来查找（因为email是加密的）
    existing_stakeholder = Stakeholder.objects.filter(
        tenant=profile.tenant,
        notes__contains=f'系统用户: {profile.user.username}'
    ).first()

    if profile.status == UserProfile.UserStatus.ACTIVE:
        # 激活状态：添加或更新干系人
        if not existing_stakeholder:
            stakeholder = Stakeholder(tenant=profile.tenant)
            stakeholder.name = profile.user.username
            stakeholder.position = profile.position or ''
            stakeholder.department = profile.department or ''
            stakeholder.stakeholder_type = Stakeholder.StakeholderType.CUSTOMER
            stakeholder.is_primary = False
            stakeholder.notes = f'系统用户: {profile.user.username}'
            
            # 加密字段可能因配置问题失败，使用未加密存储
            try:
                stakeholder.phone = profile.phone or ''
            except Exception as e:
                logger.warning(f"设置干系人phone字段失败: {e}")
                stakeholder.phone_encrypted = profile.phone or ''
            
            try:
                stakeholder.email = profile.user.email or ''
            except Exception as e:
                logger.warning(f"设置干系人email字段失败: {e}")
                stakeholder.email_encrypted = profile.user.email or ''
            
            stakeholder.save()
            logger.info(f"用户 {profile.user.username} 已添加到租户 {profile.tenant.name} 的干系人列表")
        else:
            # 更新现有干系人的联系信息（如果为空）
            updated = False
            if not existing_stakeholder.email_encrypted and profile.user.email:
                try:
                    existing_stakeholder.email = profile.user.email
                except Exception as e:
                    logger.warning(f"更新干系人email字段失败: {e}")
                    existing_stakeholder.email_encrypted = profile.user.email
                updated = True
            
            if not existing_stakeholder.phone_encrypted and profile.phone:
                try:
                    existing_stakeholder.phone = profile.phone
                except Exception as e:
                    logger.warning(f"更新干系人phone字段失败: {e}")
                    existing_stakeholder.phone_encrypted = profile.phone
                updated = True
            
            if updated:
                existing_stakeholder.save()
                logger.info(f"用户 {profile.user.username} 的干系人联系信息已更新")

    elif profile.status == UserProfile.UserStatus.SUSPENDED:
        # 已暂停状态：保留在干系人列表，如果不存在则添加
        if not existing_stakeholder:
            stakeholder = Stakeholder(tenant=profile.tenant)
            stakeholder.name = profile.user.username
            stakeholder.position = profile.position or ''
            stakeholder.department = profile.department or ''
            stakeholder.stakeholder_type = Stakeholder.StakeholderType.CUSTOMER
            stakeholder.is_primary = False
            stakeholder.notes = f'系统用户: {profile.user.username}'
            
            # 加密字段可能因配置问题失败，使用未加密存储
            try:
                stakeholder.phone = profile.phone or ''
            except Exception:
                stakeholder.phone_encrypted = profile.phone or ''
            
            try:
                stakeholder.email = profile.user.email or ''
            except Exception:
                stakeholder.email_encrypted = profile.user.email or ''
            
            stakeholder.save()
            logger.info(f"用户 {profile.user.username} (暂停状态) 已添加到租户 {profile.tenant.name} 的干系人列表")

    elif profile.status in [UserProfile.UserStatus.PENDING, UserProfile.UserStatus.REJECTED]:
        # 待审核和已拒绝状态：移除干系人
        if existing_stakeholder:
            existing_stakeholder.delete()
            logger.info(f"用户 {profile.user.username} 已从租户 {profile.tenant.name} 的干系人列表移除")


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
        logger.info(f"收到注册请求数据: {data}")
        serializer = UserRegisterSerializer(data=data)

        if serializer.is_valid():
            profile = serializer.save()
            logger.info(f"新用户注册: {profile.user.username}, 租户: {profile.tenant.name}")
            return JsonResponse({
                'detail': '注册成功，请等待管理员审核',
                'username': profile.user.username,
                'status': profile.status
            }, status=201)

        logger.error(f"注册验证失败: {serializer.errors}")
        return JsonResponse(serializer.errors, status=400)
    except json.JSONDecodeError:
        logger.error("注册失败: 无效的JSON数据")
        return JsonResponse({'detail': '无效的JSON数据'}, status=400)
    except Exception as e:
        logger.error(f"注册失败: {str(e)}", exc_info=True)
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

    def create(self, request, *args, **kwargs):
        """创建用户"""
        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
            # 返回详细的验证错误信息
            errors = serializer.errors
            error_messages = []
            for field, field_errors in errors.items():
                for error in field_errors:
                    if field == 'non_field_errors':
                        error_messages.append(str(error))
                    elif field == 'username':
                        error_messages.append(f"用户名: {error}")
                    elif field == 'email':
                        error_messages.append(f"邮箱: {error}")
                    elif field == 'tenant_id':
                        error_messages.append(f"租户: {error}")
                    elif field == 'password':
                        error_messages.append(f"密码: {error}")
                    else:
                        error_messages.append(f"{field}: {error}")

            return Response({
                'detail': '; '.join(error_messages) if error_messages else '创建用户失败',
                'errors': errors
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile = serializer.save()
            logger.info(f"管理员 {request.user.username} 创建了用户 {profile.user.username}")

            # 如果是激活状态，尝试同步到干系人列表（失败不影响用户创建）
            if profile.status == UserProfile.UserStatus.ACTIVE and profile.tenant:
                try:
                    sync_user_to_stakeholder(profile)
                except Exception as sync_error:
                    logger.warning(f"同步用户到干系人列表失败: {str(sync_error)}")
                    # 不抛出异常，用户已创建成功

            return Response({
                'detail': '用户创建成功',
                'username': profile.user.username,
                'email': profile.user.email,
                'user_type': profile.user_type,
                'user_type_display': profile.get_user_type_display(),
                'status': profile.status,
                'status_display': profile.get_status_display(),
                'tenant_id': str(profile.tenant.id) if profile.tenant else None,
                'tenant_name': profile.tenant.name if profile.tenant else None,
                'id': str(profile.id)
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}", exc_info=True)
            return Response({
                'detail': f'创建用户失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_update(self, serializer):
        """更新用户"""
        profile = serializer.save()
        logger.info(f"管理员 {self.request.user.username} 更新了用户 {profile.user.username}")

    def perform_destroy(self, instance):
        """删除用户"""
        username = instance.user.username

        # 删除对应的干系人记录
        if instance.tenant:
            stakeholder = Stakeholder.objects.filter(
                tenant=instance.tenant,
                notes__contains=f'系统用户: {username}'
            ).first()
            if stakeholder:
                stakeholder.delete()
                logger.info(f"已删除用户 {username} 对应的干系人记录")

        instance.user.delete()
        logger.info(f"管理员 {self.request.user.username} 删除了用户 {username}")

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """审核通过用户"""
        # 权限检查：只有管理员可以审批
        if not is_admin_user(request.user):
            return Response(
                {'detail': '只有管理员可以审批用户'},
                status=status.HTTP_403_FORBIDDEN
            )

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

        # 同步到干系人列表
        try:
            sync_user_to_stakeholder(profile)
        except Exception as e:
            logger.warning(f"同步用户到干系人列表失败: {str(e)}")

        logger.info(f"管理员 {request.user.username} 审核通过了用户 {profile.user.username}")
        return Response({'detail': '用户已审核通过'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒绝用户注册"""
        # 权限检查：只有管理员可以拒绝
        if not is_admin_user(request.user):
            return Response(
                {'detail': '只有管理员可以拒绝用户注册'},
                status=status.HTTP_403_FORBIDDEN
            )

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

        # 从干系人列表移除
        try:
            sync_user_to_stakeholder(profile)
        except Exception as e:
            logger.warning(f"同步用户到干系人列表失败: {str(e)}")

        logger.info(f"管理员 {request.user.username} 拒绝了用户 {profile.user.username}")
        return Response({'detail': '用户注册已拒绝'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活用户"""
        # 权限检查：只有管理员可以激活用户
        if not is_admin_user(request.user):
            return Response(
                {'detail': '只有管理员可以激活用户'},
                status=status.HTTP_403_FORBIDDEN
            )

        profile = self.get_object()
        profile.status = UserProfile.UserStatus.ACTIVE
        profile.user.is_active = True
        profile.save()
        profile.user.save()

        # 同步到干系人列表
        try:
            sync_user_to_stakeholder(profile)
        except Exception as e:
            logger.warning(f"同步用户到干系人列表失败: {str(e)}")

        logger.info(f"管理员 {request.user.username} 激活了用户 {profile.user.username}")
        return Response({'detail': '用户已激活'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """暂停用户"""
        # 权限检查：只有管理员可以暂停用户
        if not is_admin_user(request.user):
            return Response(
                {'detail': '只有管理员可以暂停用户'},
                status=status.HTTP_403_FORBIDDEN
            )

        profile = self.get_object()

        # 不能暂停自己
        if profile.user == request.user:
            return Response(
                {'detail': '不能暂停自己的账号'},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile.status = UserProfile.UserStatus.SUSPENDED
        profile.user.is_active = False
        profile.save()
        profile.user.save()

        logger.info(f"管理员 {request.user.username} 暂停了用户 {profile.user.username}")
        return Response({'detail': '用户已暂停'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """重置用户密码"""
        # 权限检查：只有管理员可以重置其他用户密码
        profile = self.get_object()
        if profile.user != request.user and not is_admin_user(request.user):
            return Response(
                {'detail': '只有管理员可以重置其他用户的密码'},
                status=status.HTTP_403_FORBIDDEN
            )

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


@csrf_exempt
@require_http_methods(["POST"])
def verify_user_for_reset(request):
    """
    验证用户信息用于密码重置（公开接口）
    用户提供用户名和邮箱，验证是否匹配
    """
    try:
        data = json.loads(request.body)
        username = data.get('username')
        email = data.get('email')

        if not username or not email:
            return JsonResponse({'detail': '请提供用户名和邮箱'}, status=400)

        try:
            user = User.objects.get(username=username, email=email)
            logger.info(f"用户 {username} 验证成功，准备重置密码")
            return JsonResponse({
                'detail': '验证成功',
                'user_id': user.id,
                'username': user.username
            }, status=200)
        except User.DoesNotExist:
            logger.warning(f"密码重置验证失败: 用户名 {username} 和邮箱不匹配")
            return JsonResponse({'detail': '用户名或邮箱不正确'}, status=404)

    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的JSON数据'}, status=400)
    except Exception as e:
        logger.error(f"验证用户失败: {str(e)}", exc_info=True)
        return JsonResponse({'detail': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reset_password(request):
    """
    重置用户密码（公开接口）
    需要先通过验证接口验证用户身份
    """
    try:
        data = json.loads(request.body)
        username = data.get('username')
        email = data.get('email')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        if not all([username, email, new_password, confirm_password]):
            return JsonResponse({'detail': '请提供所有必需的信息'}, status=400)

        if new_password != confirm_password:
            return JsonResponse({'detail': '两次输入的密码不一致'}, status=400)

        # 再次验证用户信息
        try:
            user = User.objects.get(username=username, email=email)
        except User.DoesNotExist:
            return JsonResponse({'detail': '用户名或邮箱不正确'}, status=404)

        # 验证密码强度
        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(new_password, user=user)
        except Exception as e:
            return JsonResponse({'detail': str(e)}, status=400)

        # 重置密码
        user.set_password(new_password)
        user.save()

        logger.info(f"用户 {username} 成功重置密码")
        return JsonResponse({
            'detail': '密码重置成功，请使用新密码登录'
        }, status=200)

    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的JSON数据'}, status=400)
    except Exception as e:
        logger.error(f"重置密码失败: {str(e)}", exc_info=True)
        return JsonResponse({'detail': str(e)}, status=500)