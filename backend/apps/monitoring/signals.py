"""
Signal handlers for automatic activity logging
"""
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import ActivityLog


@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    """记录用户登录"""
    ip_address = request.META.get('REMOTE_ADDR')
    ActivityLog.log_activity(
        action_type='login',
        description=f'用户 {user.username} 登录系统',
        user=user,
        ip_address=ip_address
    )


@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    """记录用户登出"""
    if user:
        ip_address = request.META.get('REMOTE_ADDR')
        ActivityLog.log_activity(
            action_type='logout',
            description=f'用户 {user.username} 登出系统',
            user=user,
            ip_address=ip_address
        )
