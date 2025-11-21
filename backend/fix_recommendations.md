# 修复代码建议

## P0 优先级 - 立即修复

### 1. 修复 auth_serializers.py - 添加is_active检查

**文件**: apps/tenants/auth_serializers.py

```python
"""
认证序列化器
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from .user_models import UserProfile


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """自定义JWT Token序列化器"""

    def validate(self, attrs):
        """验证并返回token"""
        data = super().validate(attrs)

        try:
            # 检查Django User的is_active字段
            if not self.user.is_active:
                raise serializers.ValidationError({
                    'detail': '账户已被禁用，请联系管理员'
                })

            profile = self.user.profile

            if profile.status != UserProfile.UserStatus.ACTIVE:
                raise serializers.ValidationError({
                    'detail': '账号未激活或已被暂停，请联系管理员'
                })

            data['user_type'] = profile.user_type
            data['user_id'] = str(self.user.id)
            data['username'] = self.user.username
            data['email'] = self.user.email

            if profile.tenant:
                data['tenant_id'] = str(profile.tenant.id)
                data['tenant_name'] = profile.tenant.name
            else:
                data['tenant_id'] = None
                data['tenant_name'] = None

        except UserProfile.DoesNotExist:
            raise serializers.ValidationError({
                'detail': '用户配置不存在，请联系管理员'
            })

        return data

    @classmethod
    def get_token(cls, user):
        """添加自定义声明到token"""
        token = super().get_token(user)

        try:
            profile = user.profile
            token['user_type'] = profile.user_type
            token['user_id'] = str(user.id)

            if profile.tenant:
                token['tenant_id'] = str(profile.tenant.id)
            else:
                token['tenant_id'] = None

        except UserProfile.DoesNotExist:
            pass

        return token
```

---

### 2. 修复 user_views.py - 添加权限检查和修复Stakeholder问题

**关键修改**:

#### 2.1 修复sync_user_to_stakeholder函数

```python
def sync_user_to_stakeholder(profile):
    """
    同步用户到干系人列表
    - 已激活(active)状态：添加到干系人列表
    - 待审核(pending)和已拒绝(rejected)状态：从干系人列表移除
    - 已暂停(suspended)状态：保留在干系人列表
    
    使用事务确保原子性
    """
    from django.db import transaction
    
    if not profile.tenant:
        return

    try:
        with transaction.atomic():
            # 查找是否已存在对应的干系人记录
            existing_stakeholder = Stakeholder.objects.filter(
                tenant=profile.tenant,
                notes__contains=f'系统用户: {profile.user.username}'
            ).first()

            if profile.status == UserProfile.UserStatus.ACTIVE:
                # 激活状态：添加或更新干系人
                if not existing_stakeholder:
                    stakeholder = Stakeholder(tenant=profile.tenant)
                    stakeholder.name = profile.user.username
                    stakeholder.phone = profile.phone or ''  # setter会处理加密
                    stakeholder.email = profile.user.email   # setter会处理加密
                    stakeholder.position = profile.position or ''
                    stakeholder.department = profile.department or ''
                    stakeholder.stakeholder_type = Stakeholder.StakeholderType.CUSTOMER
                    stakeholder.is_primary = False
                    stakeholder.notes = f'系统用户: {profile.user.username}'
                    stakeholder.save()
                    logger.info(f"用户 {profile.user.username} 已添加到租户 {profile.tenant.name} 的干系人列表")
                else:
                    # 更新现有干系人信息
                    existing_stakeholder.phone = profile.phone or ''
                    existing_stakeholder.email = profile.user.email
                    existing_stakeholder.position = profile.position or ''
                    existing_stakeholder.department = profile.department or ''
                    existing_stakeholder.save()
                    logger.info(f"用户 {profile.user.username} 的干系人信息已更新")

            elif profile.status in [UserProfile.UserStatus.PENDING, UserProfile.UserStatus.REJECTED]:
                # 待审核或已拒绝状态：移除干系人
                if existing_stakeholder:
                    existing_stakeholder.delete()
                    logger.info(f"用户 {profile.user.username} 已从租户 {profile.tenant.name} 的干系人列表移除")

    except Exception as e:
        logger.error(f"同步用户到干系人列表失败: {str(e)}", exc_info=True)
        raise
```

#### 2.2 在UserProfileViewSet中添加权限检查

```python
from .permissions import IsAdminUser

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

    def check_admin_permission(self):
        """检查是否是管理员"""
        try:
            profile = self.request.user.profile
            if not profile.is_admin or not profile.is_active:
                return False
            return True
        except UserProfile.DoesNotExist:
            return False

    def create(self, request, *args, **kwargs):
        """创建用户 - 仅管理员"""
        if not self.check_admin_permission():
            return Response(
                {'detail': '只有管理员可以创建用户'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(data=request.data)

        if not serializer.is_valid():
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

            if profile.status == UserProfile.UserStatus.ACTIVE and profile.tenant:
                try:
                    sync_user_to_stakeholder(profile)
                except Exception as sync_error:
                    logger.warning(f"同步用户到干系人列表失败: {str(sync_error)}")

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
        if not self.check_admin_permission():
            raise PermissionDenied('只有管理员可以更新用户')
        
        profile = serializer.save()
        logger.info(f"管理员 {self.request.user.username} 更新了用户 {profile.user.username}")

    def perform_destroy(self, instance):
        """删除用户 - 仅管理员"""
        if not self.check_admin_permission():
            raise PermissionDenied('只有管理员可以删除用户')
        
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
        """审核通过用户 - 仅管理员"""
        if not self.check_admin_permission():
            return Response(
                {'detail': '权限不足'},
                status=status.HTTP_403_FORBIDDEN
            )

        profile = self.get_object()

        if profile.status != UserProfile.UserStatus.PENDING:
            return Response(
                {'detail': '该用户不是待审核状态'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        try:
            with transaction.atomic():
                profile.status = UserProfile.UserStatus.ACTIVE
                profile.user.is_active = True
                profile.save()
                profile.user.save()

                # 同步到干系人列表
                sync_user_to_stakeholder(profile)

                logger.info(f"管理员 {request.user.username} 审核通过了用户 {profile.user.username}")
        except Exception as e:
            logger.error(f"审核通过用户失败: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'操作失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'detail': '用户已审核通过'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒绝用户注册 - 仅管理员"""
        if not self.check_admin_permission():
            return Response(
                {'detail': '权限不足'},
                status=status.HTTP_403_FORBIDDEN
            )

        profile = self.get_object()

        if profile.status != UserProfile.UserStatus.PENDING:
            return Response(
                {'detail': '该用户不是待审核状态'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        try:
            with transaction.atomic():
                profile.status = UserProfile.UserStatus.REJECTED
                profile.user.is_active = False
                profile.save()
                profile.user.save()

                # 从干系人列表移除
                sync_user_to_stakeholder(profile)

                logger.info(f"管理员 {request.user.username} 拒绝了用户 {profile.user.username}")
        except Exception as e:
            logger.error(f"拒绝用户失败: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'操作失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'detail': '用户注册已拒绝'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活用户 - 仅管理员"""
        if not self.check_admin_permission():
            return Response(
                {'detail': '权限不足'},
                status=status.HTTP_403_FORBIDDEN
            )

        profile = self.get_object()
        
        # 允许的状态转换
        if profile.status not in [UserProfile.UserStatus.SUSPENDED, UserProfile.UserStatus.REJECTED]:
            return Response(
                {'detail': f'不能从{profile.get_status_display()}状态激活用户'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        try:
            with transaction.atomic():
                profile.status = UserProfile.UserStatus.ACTIVE
                profile.user.is_active = True
                profile.save()
                profile.user.save()

                # 同步到干系人列表
                if profile.tenant:
                    sync_user_to_stakeholder(profile)

                logger.info(f"管理员 {request.user.username} 激活了用户 {profile.user.username}")
        except Exception as e:
            logger.error(f"激活用户失败: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'操作失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'detail': '用户已激活'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """暂停用户 - 仅管理员"""
        if not self.check_admin_permission():
            return Response(
                {'detail': '权限不足'},
                status=status.HTTP_403_FORBIDDEN
            )

        profile = self.get_object()
        
        if profile.status == UserProfile.UserStatus.SUSPENDED:
            return Response(
                {'detail': '用户已处于暂停状态'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        try:
            with transaction.atomic():
                profile.status = UserProfile.UserStatus.SUSPENDED
                profile.user.is_active = False
                profile.save()
                profile.user.save()

                logger.info(f"管理员 {request.user.username} 暂停了用户 {profile.user.username}")
        except Exception as e:
            logger.error(f"暂停用户失败: {str(e)}", exc_info=True)
            return Response(
                {'detail': f'操作失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'detail': '用户已暂停'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """重置用户密码 - 仅管理员"""
        if not self.check_admin_permission():
            return Response(
                {'detail': '权限不足'},
                status=status.HTTP_403_FORBIDDEN
            )

        profile = self.get_object()
        serializer = UserPasswordResetSerializer(data=request.data)

        if serializer.is_valid():
            profile.user.set_password(serializer.validated_data['new_password'])
            profile.user.save()

            logger.info(f"管理员 {request.user.username} 重置了用户 {profile.user.username} 的密码")
            return Response({'detail': '密码重置成功'}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ... 其他方法保持不变 ...
```

---

## P1 优先级 - 高优先级修复

### 3. 修复 user_serializers.py - 修复用户编辑序列化器

```python
class UserUpdateSerializer(serializers.ModelSerializer):
    """用户更新序列化器 - 只允许更新基本信息"""

    email = serializers.EmailField(source='user.email')

    class Meta:
        model = UserProfile
        fields = ['email', 'phone', 'department', 'position']
        read_only_fields = []

    def validate_email(self, value):
        """验证邮箱"""
        user = self.instance.user
        if User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("该邮箱已被使用")
        return value

    def update(self, instance, validated_data):
        """更新用户"""
        user_data = validated_data.pop('user', {})
        if 'email' in user_data:
            instance.user.email = user_data['email']
            instance.user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance
```

---

### 4. 修复密码重置API - 防止用户信息泄露

```python
@csrf_exempt
@require_http_methods(["POST"])
def verify_user_for_reset(request):
    """
    验证用户信息用于密码重置（公开接口）
    用户提供用户名和邮箱，验证是否匹配
    
    安全改进：
    - 不返回user_id
    - 成功和失败返回相同信息，防止信息泄露
    - 应该发送验证邮件（TODO）
    """
    try:
        data = json.loads(request.body)
        username = data.get('username')
        email = data.get('email')

        if not username or not email:
            return JsonResponse({'detail': '请提供用户名和邮箱'}, status=400)

        try:
            user = User.objects.get(username=username, email=email)
            # TODO: 生成验证token并发送邮件
            # 目前返回统一信息以防止用户枚举
            logger.info(f"用户 {username} 验证成功，准备重置密码")
            return JsonResponse({
                'detail': '验证成功，重置链接已发送到您的邮箱'
            }, status=200)
        except User.DoesNotExist:
            # 返回相同信息，防止信息泄露
            logger.warning(f"密码重置验证失败: 用户名 {username} 和邮箱不匹配")
            return JsonResponse({
                'detail': '验证成功，重置链接已发送到您的邮箱'
            }, status=200)  # 故意返回200，隐藏用户是否存在的信息

    except json.JSONDecodeError:
        return JsonResponse({'detail': '无效的JSON数据'}, status=400)
    except Exception as e:
        logger.error(f"验证用户失败: {str(e)}", exc_info=True)
        return JsonResponse({'detail': '系统错误'}, status=500)
```

---

## P2 优先级 - 中等优先级修复

### 5. 添加工具函数 - 统一密码验证

**新建文件**: apps/tenants/utils.py

```python
"""
用户管理工具函数
"""

from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers


def validate_password_strength(password, user=None):
    """
    统一的密码强度验证
    
    Args:
        password: 要验证的密码
        user: 可选的User对象，用于上下文验证
        
    Returns:
        True 如果密码有效
        
    Raises:
        ValidationError: 如果密码不符合要求
    """
    try:
        django_validate_password(password, user=user)
        return True
    except ValidationError as e:
        raise serializers.ValidationError({
            'password': str(e) if isinstance(e, str) else ' '.join(e.messages)
        })


def check_user_status_transition(current_status, target_status):
    """
    检查用户状态转换是否有效
    
    允许的转换:
    - PENDING -> ACTIVE (审核通过)
    - PENDING -> REJECTED (拒绝)
    - ACTIVE -> SUSPENDED (暂停)
    - SUSPENDED -> ACTIVE (恢复)
    - REJECTED -> PENDING (重新审核)
    
    Args:
        current_status: 当前状态
        target_status: 目标状态
        
    Returns:
        True 如果转换有效，False 否则
    """
    from .user_models import UserProfile
    
    ALLOWED_TRANSITIONS = {
        UserProfile.UserStatus.PENDING: [
            UserProfile.UserStatus.ACTIVE,
            UserProfile.UserStatus.REJECTED
        ],
        UserProfile.UserStatus.ACTIVE: [
            UserProfile.UserStatus.SUSPENDED
        ],
        UserProfile.UserStatus.SUSPENDED: [
            UserProfile.UserStatus.ACTIVE,
            UserProfile.UserStatus.REJECTED
        ],
        UserProfile.UserStatus.REJECTED: [
            UserProfile.UserStatus.PENDING
        ],
    }
    
    return target_status in ALLOWED_TRANSITIONS.get(current_status, [])
```

---

### 6. 添加速率限制

**修改**: cloud_platform/settings.py

在REST_FRAMEWORK配置中添加:

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    # 添加速率限制
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',  # 匿名用户
        'user': '1000/hour',  # 认证用户
    }
}

# 针对特定端点的速率限制配置
AUTH_USER_THROTTLE_RATES = {
    'register': '5/hour',
    'login': '10/hour',
    'password_reset': '5/hour',
}
```

---

### 7. 创建自定义权限类加强器

**修改**: apps/tenants/permissions.py

```python
"""
自定义权限类
"""

from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from .user_models import UserProfile


class IsAdminUser(permissions.BasePermission):
    """只允许管理员访问"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            return profile.is_admin and profile.is_active and request.user.is_active
        except UserProfile.DoesNotExist:
            return False


class IsTenantUser(permissions.BasePermission):
    """只允许租户用户访问"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            return profile.is_tenant_user and profile.is_active and request.user.is_active
        except UserProfile.DoesNotExist:
            return False


class IsAdminOrReadOnly(permissions.BasePermission):
    """管理员可以修改，其他用户只读"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            if not profile.is_active or not request.user.is_active:
                return False

            if request.method in permissions.SAFE_METHODS:
                return True

            return profile.is_admin
        except UserProfile.DoesNotExist:
            return False


class IsTenantOwnerOrAdmin(permissions.BasePermission):
    """租户所有者或管理员可以访问"""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            if not profile.is_active or not request.user.is_active:
                return False

            if profile.is_admin:
                return True

            if hasattr(obj, 'tenant'):
                return obj.tenant == profile.tenant

            return False
        except UserProfile.DoesNotExist:
            return False


class CanManageUsers(permissions.BasePermission):
    """只有管理员可以管理用户"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            # 检查is_active和user.is_active
            if not profile.is_active or not request.user.is_active:
                return False
                
            return profile.is_admin
        except UserProfile.DoesNotExist:
            return False

    def has_object_permission(self, request, view, obj):
        try:
            profile = request.user.profile
            if not profile.is_active or not request.user.is_active:
                return False
                
            return profile.is_admin
        except UserProfile.DoesNotExist:
            return False
```

---

