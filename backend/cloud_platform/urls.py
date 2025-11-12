"""
云平台主路由配置
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    # 管理后台
    path('admin/', admin.site.urls),

    # JWT认证
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # 应用路由
    path('api/tenants/', include('apps.tenants.urls')),
    path('api/openstack/', include('apps.openstack.urls')),
    path('api/contracts/', include('apps.contracts.urls')),
]

# 开发环境下的静态文件和媒体文件服务
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# 自定义管理后台标题
admin.site.site_header = "云平台管理系统"
admin.site.site_title = "云平台管理"
admin.site.index_title = "欢迎使用云平台管理系统"