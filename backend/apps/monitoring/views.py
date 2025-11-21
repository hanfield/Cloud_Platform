from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from .models import SystemMetrics, ActivityLog
from .utils import get_system_resources, get_service_status, calculate_system_health


class MonitoringViewSet(viewsets.ViewSet):
    """系统监控API"""
    permission_classes = [IsAdminUser]

    def get_permissions(self):
        """根据action动态设置权限"""
        if self.action == 'login_history':
            # 登录历史允许普通认证用户访问
            return [IsAuthenticated()]
        return [IsAdminUser()]

    @action(detail=False, methods=['get'])
    def resources(self, request):
        """获取系统资源使用情况"""
        resources = get_system_resources()
        
        # 保存到数据库（可选）
        SystemMetrics.objects.create(
            cpu_usage=resources['cpu_usage'],
            memory_usage=resources['memory_usage'],
            disk_usage=resources['disk_usage']
        )
        
        return Response(resources)

    @action(detail=False, methods=['get'])
    def services(self, request):
        """获取服务状态"""
        services = get_service_status()
        return Response({
            'services': services,
            'total': len(services),
            'running': sum(1 for s in services if s['status'] == 'running')
        })

    @action(detail=False, methods=['get'])
    def health(self, request):
        """获取系统健康度"""
        health_score = calculate_system_health()
        return Response({
            'health_score': health_score,
            'status': 'healthy' if health_score > 80 else 'warning' if health_score > 60 else 'critical'
        })

    @action(detail=False, methods=['get'])
    def activities(self, request):
        """获取最近活动"""
        limit = int(request.query_params.get('limit', 10))
        
        activities = ActivityLog.objects.select_related('user').all()[:limit]
        
        data = []
        for activity in activities:
            # 计算时间差
            time_diff = timezone.now() - activity.created_at
            if time_diff.total_seconds() < 60:
                time_str = f'{int(time_diff.total_seconds())}秒前'
            elif time_diff.total_seconds() < 3600:
                time_str = f'{int(time_diff.total_seconds() / 60)}分钟前'
            elif time_diff.total_seconds() < 86400:
                time_str = f'{int(time_diff.total_seconds() / 3600)}小时前'
            else:
                time_str = f'{int(time_diff.total_seconds() / 86400)}天前'
            
            data.append({
                'id': activity.id,
                'time': time_str,
                'type': activity.action_type,
                'content': activity.description,
                'user': activity.user.username if activity.user else '系统'
            })
        
        return Response(data)

    @action(detail=False, methods=['get'], url_path='login-history')
    def login_history(self, request):
        """获取当前用户的登录历史"""
        # 获取当前用户
        user = request.user
        
        # 只返回当前用户的登录记录
        logs = ActivityLog.objects.filter(
            user=user,
            action_type='login'
        ).order_by('-created_at')[:50]
        
        data = []
        for log in logs:
            data.append({
                'id': log.id,
                'timestamp': log.created_at.isoformat(),
                'created_at': log.created_at.isoformat(),
                'ip_address': log.ip_address or '-',
                'user_agent': log.user_agent or '-',
                'action_display': log.get_action_type_display(),
                'description': log.description
            })
        
        return Response({
            'results': data,
            'count': len(data)
        })

    @action(detail=False, methods=['get'])
    def overview(self, request):
        """获取监控概览（一次性获取所有数据）"""
        return Response({
            'resources': get_system_resources(),
            'services': get_service_status(),
            'health': calculate_system_health(),
            'timestamp': timezone.now().isoformat()
        })
