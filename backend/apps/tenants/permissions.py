"""
自定义权限类
"""

from rest_framework import permissions
from .user_models import UserProfile


class IsAdminUser(permissions.BasePermission):
    """只允许管理员访问"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            return profile.is_admin and profile.is_active
        except UserProfile.DoesNotExist:
            return False


class IsTenantUser(permissions.BasePermission):
    """只允许租户用户访问"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            return profile.is_tenant_user and profile.is_active
        except UserProfile.DoesNotExist:
            return False


class IsAdminOrReadOnly(permissions.BasePermission):
    """管理员可以修改，其他用户只读"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        try:
            profile = request.user.profile
            if not profile.is_active:
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
            if not profile.is_active:
                return False

            if profile.is_admin:
                return True

            if hasattr(obj, 'tenant'):
                return obj.tenant == profile.tenant

            return False
        except UserProfile.DoesNotExist:
            return False