"""
监控相关的Celery任务
"""
from celery import shared_task
import logging
from .utils import check_vm_alerts

logger = logging.getLogger(__name__)


@shared_task(name='check_vm_alerts')
def check_alerts_task():
    """
    检查虚拟机告警任务
    定期执行，检查所有虚拟机是否触发告警规则
    """
    logger.info("开始执行告警检查任务")
    try:
        triggered_alerts = check_vm_alerts()
        logger.info(f"告警检查完成，触发了 {len(triggered_alerts)} 个新告警")
        return {
            'status': 'success',
            'triggered_count': len(triggered_alerts)
        }
    except Exception as e:
        logger.error(f"告警检查任务执行失败: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='collect_vm_metrics')
def collect_vm_metrics_task():
    """
    采集虚拟机监控数据任务
    定期从OpenStack获取虚拟机监控指标并保存到数据库
    """
    from apps.information_systems.models import VirtualMachine
    from apps.openstack.services import OpenStackService
    from .models import VMMetricHistory
    from django.utils import timezone
    
    logger.info("开始采集虚拟机监控数据")
    
    try:
        openstack_service = OpenStackService()
        # 只采集运行中的虚拟机
        running_vms = VirtualMachine.objects.filter(status='running')
        
        collected_count = 0
        for vm in running_vms:
            if not vm.openstack_id:
                continue
                
            try:
                metrics = openstack_service.get_server_metrics(vm.openstack_id)
                if metrics:
                    # 保存监控数据
                    VMMetricHistory.objects.create(
                        virtual_machine=vm,
                        cpu_usage=metrics.get('cpu_usage_percent', 0),
                        memory_usage=metrics.get('memory_usage_percent', 0),
                        network_in_rate=metrics.get('network_in_bytes', 0) / 1024,  # 转KB
                        network_out_rate=metrics.get('network_out_bytes', 0) / 1024,
                        timestamp=timezone.now()
                    )
                    collected_count += 1
            except Exception as e:
                logger.warning(f"采集虚拟机 {vm.name} 的监控数据失败: {str(e)}")
                continue
        
        logger.info(f"监控数据采集完成，成功采集 {collected_count} 个虚拟机")
        return {
            'status': 'success',
            'collected_count': collected_count
        }
    except Exception as e:
        logger.error(f"监控数据采集任务执行失败: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }


@shared_task(name='cleanup_old_metrics')
def cleanup_old_metrics_task():
    """
    清理旧的监控数据任务
    保留最近30天的数据，删除更早的数据
    """
    from .models import VMMetricHistory
    from django.utils import timezone
    from datetime import timedelta
    
    logger.info("开始清理旧的监控数据")
    
    try:
        # 删除30天前的监控数据
        cutoff_date = timezone.now() - timedelta(days=30)
        deleted_count, _ = VMMetricHistory.objects.filter(
            timestamp__lt=cutoff_date
        ).delete()
        
        logger.info(f"清理完成，删除了 {deleted_count} 条旧监控数据")
        return {
            'status': 'success',
            'deleted_count': deleted_count
        }
    except Exception as e:
        logger.error(f"清理监控数据任务执行失败: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }
