from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from django_filters.rest_framework import DjangoFilterBackend
from .models import SystemMetrics, ActivityLog, VMMetricHistory, AlertRule, AlertHistory
from .serializers import AlertRuleSerializer, AlertHistorySerializer
from .utils import get_system_resources, get_service_status, calculate_system_health
import logging

logger = logging.getLogger(__name__)

class MonitoringViewSet(viewsets.ViewSet):
    """系统监控API"""
    permission_classes = [IsAdminUser]

    def get_permissions(self):
        """根据action动态设置权限"""
        if self.action in ['login_history', 'vm_history']:
            # 登录历史和VM监控允许普通认证用户访问
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
        full_details = request.query_params.get('full', 'false').lower() == 'true'
        
        # 支持过滤
        queryset = ActivityLog.objects.select_related('user').all()
        
        # 动态过滤条件
        action_type = request.query_params.get('action_type')
        resource_type = request.query_params.get('resource_type')
        user_id = request.query_params.get('user')
        
        if action_type:
            queryset = queryset.filter(action_type=action_type)
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        activities = queryset[:limit]
        
        # 根据请求返回简化或完整数据
        if full_details:
            # 返回完整的审计日志数据（用于CloudResources审计页面）
            data = []
            for activity in activities:
                data.append({
                    'id': activity.id,
                    'created_at': activity.created_at.isoformat() if activity.created_at else None,
                    'username': activity.user.username if activity.user else '系统',
                    'action_type': activity.action_type,
                    'action_type_display': activity.get_action_type_display(),
                    'resource_type': activity.resource_type,
                    'resource_type_display': activity.get_resource_type_display(),
                    'resource_id': activity.resource_id,
                    'resource_name': activity.resource_name or '-',
                    'description': activity.description,
                    'status': activity.status,
                    'status_display': activity.get_status_display(),
                    'ip_address': activity.ip_address or '-',
                    'user_agent': activity.user_agent,
                    'request_path': activity.request_path,
                    'request_method': activity.request_method,
                    'changes': activity.changes,
                    'error_message': activity.error_message
                })
            return Response({'results': data, 'count': len(data)})
        else:
            # 返回简化版本（用于Dashboard）
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

    @action(detail=False, methods=['get'], url_path='vm-history')
    def vm_history(self, request):
        """获取虚拟机历史监控数据"""
        vm_id = request.query_params.get('vm_id')
        time_range = request.query_params.get('range', '24h')
        
        if not vm_id:
            return Response({'error': 'vm_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Check permission
        from apps.information_systems.models import VirtualMachine
        try:
            vm = VirtualMachine.objects.select_related('information_system__tenant').get(id=vm_id)
            # If not admin, check if user belongs to the tenant
            if not request.user.is_staff:
                 # Check tenant membership logic
                 pass
        except VirtualMachine.DoesNotExist:
             return Response({'error': 'VM not found'}, status=status.HTTP_404_NOT_FOUND)

        # Calculate start time
        now = timezone.now()
        if time_range == '1h':
            start_time = now - timedelta(hours=1)
        elif time_range == '4h':
            start_time = now - timedelta(hours=4)
        elif time_range == '7d':
            start_time = now - timedelta(days=7)
        else:  # 24h
            start_time = now - timedelta(hours=24)
            
        history = VMMetricHistory.objects.filter(
            virtual_machine_id=vm_id,
            timestamp__gte=start_time
        ).order_by('timestamp')
        
        data = [{
            'timestamp': h.timestamp.isoformat(),
            'cpu_usage': h.cpu_usage,
            'memory_usage': h.memory_usage,
            'network_in': h.network_in_rate,
            'network_out': h.network_out_rate
        } for h in history]
        
        # 如果没有历史数据，获取实时数据
        if not data:
            try:
                from apps.openstack.services import OpenStackService
                openstack_service = OpenStackService()
                
                # 获取虚拟机的 OpenStack ID
                if vm.openstack_id:
                    metrics = openstack_service.get_server_metrics(vm.openstack_id)
                    if metrics:
                        # 返回一个数据点（当前时刻）
                        data = [{
                            'timestamp': metrics.get('timestamp', timezone.now().isoformat()),
                            'cpu_usage': metrics.get('cpu_usage_percent', 0),
                            'memory_usage': metrics.get('memory_usage_percent', 0),
                            'network_in': metrics.get('network_in_bytes', 0) / 1024,  # 转换为 KB
                            'network_out': metrics.get('network_out_bytes', 0) / 1024
                        }]
            except Exception as e:
                logger.warning(f"无法获取虚拟机 {vm_id} 的实时监控数据: {e}")
        
        return Response(data)


class AlertRuleViewSet(viewsets.ModelViewSet):
    """告警规则管理"""
    queryset = AlertRule.objects.all()
    serializer_class = AlertRuleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['enabled', 'metric_type']

    def get_queryset(self):
        # 普通用户只能看到自己虚拟机的规则（如果有权限控制的话）
        # 这里暂时简化，管理员可以看到所有，普通用户只能看到关联到自己VM的规则
        # 需要进一步完善权限逻辑
        if self.request.user.is_staff:
            return AlertRule.objects.all()
        # 暂时返回空或者基于租户过滤，这里先返回空以安全起见，或者需要关联用户的租户
        return AlertRule.objects.none() 

class AlertHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """告警历史查询"""
    queryset = AlertHistory.objects.all()
    serializer_class = AlertHistorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'rule', 'virtual_machine']

    def get_queryset(self):
        if self.request.user.is_staff:
            return AlertHistory.objects.all()
        return AlertHistory.objects.none()

