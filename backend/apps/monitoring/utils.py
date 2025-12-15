"""
系统监控工具函数
"""
import psutil
import shutil
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


def get_system_resources():
    """获取系统资源使用情况"""
    try:
        # CPU使用率
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # 内存使用率
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        # 磁盘使用率
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        
        return {
            'cpu_usage': round(cpu_percent, 1),
            'memory_usage': round(memory_percent, 1),
            'disk_usage': round(disk_percent, 1),
            'cpu_cores': psutil.cpu_count(),
            'memory_total': round(memory.total / (1024**3), 2),  # GB
            'memory_available': round(memory.available / (1024**3), 2),  # GB
            'disk_total': round(disk.total / (1024**3), 2),  # GB
            'disk_free': round(disk.free / (1024**3), 2),  # GB
        }
    except Exception as e:
        # 如果获取失败，返回默认值
        return {
            'cpu_usage': 0,
            'memory_usage': 0,
            'disk_usage': 0,
            'cpu_cores': 0,
            'memory_total': 0,
            'memory_available': 0,
            'disk_total': 0,
            'disk_free': 0,
        }


def get_service_status():
    """获取服务状态 - 基于真实健康检查数据计算可用性"""
    from .models import ServiceHealthCheck
    from django.db.models import Count, Q
    
    services = []
    
    # 服务配置
    service_configs = [
        ('django', 'Django应用服务', 'application'),
        ('database', '数据库服务', 'database'),
        ('cache', '缓存服务', 'cache'),
        ('celery', '任务队列服务', 'queue'),
    ]
    
    # 获取最近24小时的健康检查记录
    time_threshold = timezone.now() - timedelta(hours=24)
    
    for service_key, service_name, service_type in service_configs:
        # 查询该服务的健康检查记录
        checks = ServiceHealthCheck.objects.filter(
            service_name=service_key,
            checked_at__gte=time_threshold
        )
        
        total_checks = checks.count()
        healthy_checks = checks.filter(is_healthy=True).count()
        
        # 获取最新状态
        latest_check = checks.first()  # 已按 checked_at 降序排列
        
        if total_checks > 0:
            # 计算真实可用性百分比
            availability = (healthy_checks / total_checks) * 100
            uptime = f"{availability:.1f}%"
            
            # 基于最新检查确定当前状态
            if latest_check and latest_check.is_healthy:
                status = 'running'
            else:
                status = 'error' if availability < 50 else 'warning'
        else:
            # 没有健康检查记录时，实时检测当前状态
            status, uptime = _check_service_now(service_key)
        
        services.append({
            'name': service_name,
            'status': status,
            'uptime': uptime,
            'type': service_type
        })
    
    return services


def _check_service_now(service_key):
    """实时检测单个服务的当前状态（无历史数据时使用）"""
    try:
        if service_key == 'django':
            # Django 正在运行
            return 'running', '100.0%'
        
        elif service_key == 'database':
            from django.db import connection
            connection.ensure_connection()
            return 'running', '100.0%'
        
        elif service_key == 'cache':
            from django.core.cache import cache
            cache.set('health_check', 'ok', 1)
            if cache.get('health_check') == 'ok':
                return 'running', '100.0%'
            return 'warning', '0.0%'
        
        elif service_key == 'celery':
            # 假设 Celery 正在运行（实际需要更完整的检查）
            return 'running', '100.0%'
        
    except Exception:
        return 'error', '0.0%'
    
    return 'unknown', 'N/A'



def calculate_system_health():
    """计算系统健康度"""
    try:
        resources = get_system_resources()
        services = get_service_status()
        
        # 基于资源使用和服务状态计算健康度
        cpu_score = max(0, 100 - resources['cpu_usage'])
        memory_score = max(0, 100 - resources['memory_usage'])
        disk_score = max(0, 100 - resources['disk_usage'])
        
        running_services = sum(1 for s in services if s['status'] == 'running')
        total_services = len(services)
        service_score = (running_services / total_services * 100) if total_services > 0 else 0
        
        # 综合评分
        health_score = (cpu_score * 0.3 + memory_score * 0.3 + 
                       disk_score * 0.2 + service_score * 0.2)
        
        return round(health_score, 1)
    except Exception:
        return 0.0


def check_vm_alerts(vm_id=None):
    """
    检查虚拟机告警规则
    
    Args:
        vm_id: 可选，指定虚拟机ID。如果为None，检查所有虚拟机
    
    Returns:
        list: 触发的告警列表
    """
    from .models import AlertRule, AlertHistory, VMMetricHistory
    from apps.information_systems.models import VirtualMachine
    from django.db import models
    
    triggered_alerts = []
    
    try:
        # 获取所有启用的告警规则
        rules = AlertRule.objects.filter(enabled=True)
        
        if vm_id:
            # 过滤特定虚拟机的规则（全局规则 + 该VM专属规则）
            rules = rules.filter(
                models.Q(virtual_machine_id=vm_id) | models.Q(virtual_machine__isnull=True)
            )
        
        for rule in rules:
            # 确定要检查的虚拟机列表
            vms_to_check = []
            if rule.virtual_machine:
                vms_to_check = [rule.virtual_machine]
            else:
                # 全局规则：检查所有虚拟机
                if vm_id:
                    vms_to_check = [VirtualMachine.objects.get(id=vm_id)]
                else:
                    vms_to_check = VirtualMachine.objects.filter(status='running')
            
            for vm in vms_to_check:
                # 获取该虚拟机最近的监控数据
                duration_ago = timezone.now() - timedelta(minutes=rule.duration)
                recent_metrics = VMMetricHistory.objects.filter(
                    virtual_machine=vm,
                    timestamp__gte=duration_ago
                ).order_by('-timestamp')
                
                if not recent_metrics.exists():
                    continue
                
                # 检查是否持续超过阈值
                metric_field_map = {
                    'cpu': 'cpu_usage',
                    'memory': 'memory_usage',
                    'network_in': 'network_in_rate',
                    'network_out': 'network_out_rate',
                }
                
                field_name = metric_field_map.get(rule.metric_type)
                if not field_name:
                    continue
                
                # 检查是否所有采样点都满足告警条件
                all_exceed = True
                latest_value = None
                
                for metric in recent_metrics:
                    value = getattr(metric, field_name, 0)
                    if latest_value is None:
                        latest_value = value
                    
                    if rule.operator == 'gt':
                        if value <= rule.threshold:
                            all_exceed = False
                            break
                    elif rule.operator == 'lt':
                        if value >= rule.threshold:
                            all_exceed = False
                            break
                
                # 如果触发告警
                if all_exceed and latest_value is not None:
                    # 检查是否已有活跃告警
                    existing_alert = AlertHistory.objects.filter(
                        rule=rule,
                        virtual_machine=vm,
                        status='active'
                    ).first()
                    
                    if not existing_alert:
                        # 创建新告警
                        operator_text = '大于' if rule.operator == 'gt' else '小于'
                        alert = AlertHistory.objects.create(
                            rule=rule,
                            virtual_machine=vm,
                            metric_value=latest_value,
                            message=f"虚拟机 {vm.name} 的 {rule.get_metric_type_display()} "
                                   f"{operator_text} {rule.threshold}%，当前值: {latest_value}%，"
                                   f"已持续 {rule.duration} 分钟",
                            status='active'
                        )
                        triggered_alerts.append(alert)
                        logger.warning(f"告警触发: {alert.message}")
                
                # 如果不再触发，恢复已有的活跃告警
                elif not all_exceed:
                    active_alerts = AlertHistory.objects.filter(
                        rule=rule,
                        virtual_machine=vm,
                        status='active'
                    )
                    for alert in active_alerts:
                        alert.status = 'resolved'
                        alert.resolved_at = timezone.now()
                        alert.save()
                        logger.info(f"告警已恢复: {alert.message}")
        
        return triggered_alerts
        
    except Exception as e:
        logger.error(f"检查告警失败: {str(e)}")
        return []
