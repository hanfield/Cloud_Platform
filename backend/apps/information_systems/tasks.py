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