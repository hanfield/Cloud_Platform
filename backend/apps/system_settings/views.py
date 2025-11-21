from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import SystemSetting


class SystemSettingsViewSet(viewsets.ViewSet):
    """系统设置ViewSet"""
    permission_classes = [IsAdminUser]

    def list(self, request):
        """获取所有设置"""
        categories = ['system', 'database', 'openstack', 'notification']
        result = {}
        
        for category in categories:
            result[category] = SystemSetting.get_settings(category)
        
        return Response(result)

    def create(self, request):
        """更新设置 - 使用POST/PUT都可以"""
        category = request.data.get('category')
        settings = request.data.get('settings')
        
        if not category or not settings:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            SystemSetting.update_settings(category, settings)
            return Response({
                'message': '设置保存成功',
                'category': category,
                'settings': settings
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['put', 'post'])
    def save(self, request):
        """保存设置 - 自定义action"""
        category = request.data.get('category')
        settings = request.data.get('settings')
        
        if not category or not settings:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            SystemSetting.update_settings(category, settings)
            return Response({
                'message': '设置保存成功',
                'category': category,
                'settings': settings
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def category(self, request):
        """获取特定分类的设置"""
        category = request.query_params.get('name')
        if not category:
            return Response(
                {'error': '缺少category参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        settings = SystemSetting.get_settings(category)
        return Response({
            'category': category,
            'settings': settings
        })
