"""
Celery定时任务配置
"""

from celery import shared_task
from celery.schedules import crontab
from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)


@shared_task(name='sync_openstack_vms')
def sync_openstack_vms_task():
    """
    定时从OpenStack同步虚拟机数据
    包括自动清理已删除的虚拟机
    """
    try:
        logger.info('开始定时同步OpenStack虚拟机数据...')
        # 自动同步时启用清理功能
        call_command('sync_openstack_vms', cleanup_deleted=True)
        logger.info('OpenStack虚拟机数据同步完成')
    except Exception as e:
        logger.error(f'同步OpenStack虚拟机数据失败: {str(e)}', exc_info=True)


@shared_task(name='cleanup_old_logs')
def cleanup_old_logs():
    """
    清理旧的操作日志（保留最近90天）
    """
    try:
        from datetime import timedelta
        from django.utils import timezone
        from apps.information_systems.models import VMOperationLog, SystemOperationLog
        
        cutoff_date = timezone.now() - timedelta(days=90)
        
        vm_logs_deleted = VMOperationLog.objects.filter(operation_time__lt=cutoff_date).delete()[0]
        system_logs_deleted = SystemOperationLog.objects.filter(operation_time__lt=cutoff_date).delete()[0]
        
        logger.info(f'清理完成: 虚拟机日志 {vm_logs_deleted} 条, 系统日志 {system_logs_deleted} 条')
    except Exception as e:
        logger.error(f'清理日志失败: {str(e)}', exc_info=True)


@shared_task(name='collect_vm_metrics')
def collect_vm_metrics():
    """
    采集虚拟机监控指标 (每5分钟执行一次)
    """
    try:
        from django.utils import timezone
        from apps.information_systems.models import VirtualMachine
        from apps.monitoring.models import VMMetricHistory
        from apps.openstack.services import get_openstack_service
        
        logger.info('开始采集虚拟机监控指标...')
        openstack_service = get_openstack_service()
        
        # 只采集运行中的虚拟机
        running_vms = VirtualMachine.objects.filter(status='running', openstack_id__isnull=False)
        count = 0
        
        for vm in running_vms:
            try:
                metrics = openstack_service.get_server_metrics(vm.openstack_id)
                if metrics:
                    VMMetricHistory.objects.create(
                        virtual_machine=vm,
                        cpu_usage=metrics.get('cpu_usage_percent', 0),
                        memory_usage=metrics.get('memory_usage_percent', 0),
                        network_in_rate=metrics.get('network_in_bytes', 0) / 1024, # Convert to KB
                        network_out_rate=metrics.get('network_out_bytes', 0) / 1024, # Convert to KB
                        timestamp=timezone.now()
                    )
                    count += 1
            except Exception as vm_e:
                logger.warning(f'采集虚拟机 {vm.name} 指标失败: {str(vm_e)}')
                continue
                
        logger.info(f'监控指标采集完成: 成功采集 {count}/{running_vms.count()} 台')
        
    except Exception as e:
        logger.error(f'采集监控指标失败: {str(e)}', exc_info=True)


@shared_task(name='cleanup_old_metrics')
def cleanup_old_metrics():
    """
    清理旧的监控数据 (保留最近7天)
    """
    try:
        from datetime import timedelta
        from django.utils import timezone
        from apps.monitoring.models import VMMetricHistory
        
        cutoff_date = timezone.now() - timedelta(days=7)
        deleted_count = VMMetricHistory.objects.filter(timestamp__lt=cutoff_date).delete()[0]
        
        logger.info(f'清理旧监控数据完成: 删除 {deleted_count} 条记录')
    except Exception as e:
        logger.error(f'清理监控数据失败: {str(e)}', exc_info=True)