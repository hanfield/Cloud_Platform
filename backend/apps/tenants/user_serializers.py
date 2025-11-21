"""
用户管理序列化器
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .user_models import UserProfile
from .models import Tenant


class UserProfileSerializer(serializers.ModelSerializer):
    """用户配置序列化器"""

    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, allow_null=True)
    user_type_display = serializers.CharField(source='get_user_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'username', 'email',
            'user_type', 'user_type_display',
            'tenant', 'tenant_name',
            'status', 'status_display',
            'phone', 'department', 'position',
            'created_at', 'updated_at',
            'is_admin', 'is_tenant_user', 'is_active'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class UserRegisterSerializer(serializers.Serializer):
    """用户注册序列化器"""

    username = serializers.CharField(
        max_length=150,
        help_text="用户名，只能包含字母、数字和 @/./+/-/_ 字符"
    )
    email = serializers.EmailField(help_text="邮箱地址")
    password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        help_text="密码，至少8个字符"
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
        help_text="确认密码"
    )
    tenant_id = serializers.UUIDField(help_text="所属租户ID")
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, help_text="手机号")
    department = serializers.CharField(max_length=100, required=False, allow_blank=True, help_text="部门")
    position = serializers.CharField(max_length=100, required=False, allow_blank=True, help_text="职位")

    def validate_username(self, value):
        """验证用户名"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("该用户名已被使用")
        return value

    def validate_email(self, value):
        """验证邮箱"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("该邮箱已被使用")
        return value

    def validate_tenant_id(self, value):
        """验证租户ID"""
        try:
            tenant = Tenant.objects.get(id=value)
            if tenant.status != Tenant.Status.ACTIVE:
                raise serializers.ValidationError("该租户未激活，无法注册用户")
        except Tenant.DoesNotExist:
            raise serializers.ValidationError("租户不存在")
        return value

    def validate_password(self, value):
        """验证密码强度"""
        validate_password(value)
        return value

    def validate(self, data):
        """验证密码一致性"""
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "两次输入的密码不一致"})
        return data

    def create(self, validated_data):
        """创建用户和用户配置"""
        validated_data.pop('password_confirm')
        tenant_id = validated_data.pop('tenant_id')
        phone = validated_data.pop('phone', '')
        department = validated_data.pop('department', '')
        position = validated_data.pop('position', '')

        tenant = Tenant.objects.get(id=tenant_id)

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            is_active=False
        )

        profile = UserProfile.objects.create(
            user=user,
            user_type=UserProfile.UserType.TENANT,
            tenant=tenant,
            status=UserProfile.UserStatus.PENDING,
            phone=phone,
            department=department,
            position=position
        )

        return profile


class UserCreateSerializer(serializers.Serializer):
    """管理员创建用户序列化器"""

    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    user_type = serializers.ChoiceField(choices=UserProfile.UserType.choices)
    tenant_id = serializers.UUIDField(required=False, allow_null=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department = serializers.CharField(max_length=100, required=False, allow_blank=True)
    position = serializers.CharField(max_length=100, required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=UserProfile.UserStatus.choices,
        default=UserProfile.UserStatus.ACTIVE
    )

    # 只读字段，用于返回创建后的数据
    id = serializers.UUIDField(read_only=True)
    user_type_display = serializers.CharField(read_only=True, source='get_user_type_display')
    status_display = serializers.CharField(read_only=True, source='get_status_display')
    created_at = serializers.DateTimeField(read_only=True)

    # 使用方法字段处理可能为 None 的 tenant
    tenant = serializers.SerializerMethodField()
    tenant_name = serializers.SerializerMethodField()

    def get_tenant(self, obj):
        """获取租户ID"""
        return str(obj.tenant.id) if obj.tenant else None

    def get_tenant_name(self, obj):
        """获取租户名称"""
        return obj.tenant.name if obj.tenant else None

    def validate_username(self, value):
        """验证用户名"""
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("该用户名已被使用")
        return value

    def validate_email(self, value):
        """验证邮箱"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("该邮箱已被使用")
        return value

    def validate_tenant_id(self, value):
        """验证租户ID"""
        if value:
            try:
                tenant = Tenant.objects.get(id=value)
                if tenant.status != Tenant.Status.ACTIVE:
                    raise serializers.ValidationError("该租户未激活，无法添加用户")
            except Tenant.DoesNotExist:
                raise serializers.ValidationError("租户不存在")
        return value

    def validate(self, data):
        """验证租户用户必须关联租户"""
        if data['user_type'] == UserProfile.UserType.TENANT and not data.get('tenant_id'):
            raise serializers.ValidationError({"tenant_id": "租户用户必须关联租户"})
        if data['user_type'] == UserProfile.UserType.ADMIN and data.get('tenant_id'):
            raise serializers.ValidationError({"tenant_id": "管理员用户不能关联租户"})
        return data

    def create(self, validated_data):
        """创建用户"""
        tenant_id = validated_data.pop('tenant_id', None)
        user_type = validated_data.pop('user_type')
        status = validated_data.pop('status', UserProfile.UserStatus.ACTIVE)
        phone = validated_data.pop('phone', '')
        department = validated_data.pop('department', '')
        position = validated_data.pop('position', '')

        is_active = status == UserProfile.UserStatus.ACTIVE

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            is_active=is_active
        )

        tenant = None
        if tenant_id:
            tenant = Tenant.objects.get(id=tenant_id)

        profile = UserProfile.objects.create(
            user=user,
            user_type=user_type,
            tenant=tenant,
            status=status,
            phone=phone,
            department=department,
            position=position
        )

        return profile


class UserUpdateSerializer(serializers.ModelSerializer):
    """用户更新序列化器"""

    email = serializers.EmailField(source='user.email')
    status = serializers.CharField(read_only=True)  # 状态只读，不允许通过编辑修改
    user_type = serializers.CharField(read_only=True)  # 用户类型只读，防止权限提升
    tenant = serializers.PrimaryKeyRelatedField(read_only=True)  # 租户只读，防止越权访问

    class Meta:
        model = UserProfile
        fields = ['email', 'user_type', 'tenant', 'status', 'phone', 'department', 'position']
        read_only_fields = ['status', 'user_type', 'tenant']  # 明确标记敏感字段为只读

    def validate_email(self, value):
        """验证邮箱"""
        user = self.instance.user
        if User.objects.filter(email=value).exclude(id=user.id).exists():
            raise serializers.ValidationError("该邮箱已被使用")
        return value

    def validate_tenant(self, value):
        """验证租户"""
        if value:
            if value.status != Tenant.Status.ACTIVE:
                raise serializers.ValidationError("该租户未激活，无法分配用户")
        return value

    def update(self, instance, validated_data):
        """更新用户"""
        user_data = validated_data.pop('user', {})
        if 'email' in user_data:
            instance.user.email = user_data['email']
            instance.user.save()

        # 移除status字段的处理，状态变更通过专门的action完成
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        instance.user.save()

        return instance


class UserPasswordResetSerializer(serializers.Serializer):
    """用户密码重置序列化器"""

    new_password = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate_new_password(self, value):
        """验证密码强度"""
        validate_password(value)
        return value

    def validate(self, data):
        """验证密码一致性"""
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "两次输入的密码不一致"})
        return data


class UserListSerializer(serializers.ModelSerializer):
    """用户列表序列化器"""

    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True, allow_null=True)
    user_type_display = serializers.CharField(source='get_user_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'email',
            'user_type', 'user_type_display',
            'tenant', 'tenant_name',
            'status', 'status_display',
            'phone', 'created_at'
        ]