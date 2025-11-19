"""
云平台主路由配置
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from apps.tenants.auth_serializers import CustomTokenObtainPairSerializer
from apps.tenants.user_views import user_register, verify_user_for_reset, reset_password
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [
    # 管理后台
    path('admin/', admin.site.urls),

    # JWT认证
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # 用户注册（公开接口，放在这里绕过DRF全局认证）
    path('api/auth/register/', user_register, name='user-register'),

    # 密码重置（公开接口）
    path('api/auth/verify-user/', verify_user_for_reset, name='verify-user-reset'),
    path('api/auth/reset-password/', reset_password, name='reset-password'),

    # 应用路由
    path('api/tenants/', include('apps.tenants.urls')),
    path('api/openstack/', include('apps.openstack.urls')),
    path('api/contracts/', include('apps.contracts.urls')),
    path('api/information-systems/', include('apps.information_systems.urls')),
    path('api/products/', include('apps.products.urls')),
    path('api/services/', include('apps.services.urls')),
    path('api/assets/', include('apps.assets.urls')),
]

# 开发环境下的静态文件和媒体文件服务
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# 自定义管理后台标题
admin.site.site_header = "云平台管理系统"
admin.site.site_title = "云平台管理"
admin.site.index_title = "欢迎使用云平台管理系统"