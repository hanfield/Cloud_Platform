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
            profile = self.user.profile

            if profile.status != UserProfile.UserStatus.ACTIVE:
                raise serializers.ValidationError({
                    'detail': '账号未激活或已被暂停，请联系管理员'
                })

            data['user_type'] = profile.user_type
            data['user_id'] = str(profile.id)
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
            token['user_id'] = str(profile.id)

            if profile.tenant:
                token['tenant_id'] = str(profile.tenant.id)
            else:
                token['tenant_id'] = None

        except UserProfile.DoesNotExist:
            pass

        return token