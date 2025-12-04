"""
认证序列化器
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .user_models import UserProfile
from apps.monitoring.models import ActivityLog
import logging


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """自定义JWT Token序列化器"""

    def validate(self, attrs):
        """验证并返回token"""
        username = attrs.get('username')
        password = attrs.get('password')

        # 先检查用户是否存在
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # 用户不存在，调用父类方法返回标准错误
            return super().validate(attrs)

        # 检查密码是否正确
        if not user.check_password(password):
            # 密码错误，调用父类方法返回标准错误
            return super().validate(attrs)

        # 检查用户是否被禁用（is_active=False）
        if not user.is_active:
            # 用户被禁用，检查具体原因
            try:
                profile = user.profile
                if profile.status == UserProfile.UserStatus.SUSPENDED:
                    raise serializers.ValidationError({
                        'detail': '账号已被暂停，请联系管理员'
                    })
                elif profile.status == UserProfile.UserStatus.PENDING:
                    raise serializers.ValidationError({
                        'detail': '账号待审核，请等待管理员审批'
                    })
                elif profile.status == UserProfile.UserStatus.REJECTED:
                    raise serializers.ValidationError({
                        'detail': '账号注册已被拒绝，请联系管理员'
                    })
                else:
                    raise serializers.ValidationError({
                        'detail': '账号已被禁用，请联系管理员'
                    })
            except UserProfile.DoesNotExist:
                raise serializers.ValidationError({
                    'detail': '账号已被禁用，请联系管理员'
                })

        # 用户存在且密码正确且is_active=True，调用父类方法获取token
        data = super().validate(attrs)
        
        # 记录登录活动
        try:
            request = self.context.get('request')
            ActivityLog.log_activity(
                action_type='login',
                description=f'用户 {self.user.username} 成功登录系统',
                user=self.user,
                ip_address=request.META.get('REMOTE_ADDR') if request else None,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500] if request else None,
                request_path=request.path if request else None,
                request_method=request.method if request else None,
                resource_type='other'
            )
        except Exception as e:
            # 日志记录失败不应该影响登录
            logging.error(f'记录登录活动失败: {str(e)}')
        
        # 添加用户类型信息
        try:
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