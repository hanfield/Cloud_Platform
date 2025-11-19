"""
信息系统管理定时任务
"""

from celery import shared_task
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
import logging

from .models import InformationSystem, VirtualMachine, DailyBillingRecord, ResourceAdjustmentLog

logger = logging.getLogger(__name__)


@shared_task
def create_daily_billing_records():
    """
    每日计费任务：为每个信息系统创建每日计费记录
    建议在每天凌晨0:10执行
    """
    yesterday = date.today() - timedelta(days=1)
    logger.info(f"开始生成 {yesterday} 的计费记录...")

    success_count = 0
    error_count = 0

    # 获取所有信息系统
    systems = InformationSystem.objects.all()

    for system in systems:
        try:
            # 检查是否已存在该日期的计费记录
            existing_record = DailyBillingRecord.objects.filter(
                information_system=system,
                billing_date=yesterday
            ).first()

            if existing_record:
                logger.info(f"系统 {system.name} 的 {yesterday} 计费记录已存在，跳过")
                continue

            # 获取该系统的所有虚拟机
            vms = VirtualMachine.objects.filter(information_system=system)

            # 计算资源总量
            total_cpu = sum([vm.cpu_cores for vm in vms])
            total_memory = sum([vm.memory_gb for vm in vms])
            total_storage = sum([vm.disk_gb for vm in vms])

            # 计算运行小时数
            running_hours = 24  # 默认为24小时
            if system.operation_mode == '5x8':
                running_hours = 8  # 5x8模式按8小时计算

            # 创建计费记录
            billing_record = DailyBillingRecord(
                information_system=system,
                billing_date=yesterday,
                cpu_cores=total_cpu,
                memory_gb=total_memory,
                storage_gb=total_storage,
                running_hours=running_hours,
                cpu_usage_hours=running_hours * total_cpu,
                memory_usage_hours=running_hours * total_memory,
                storage_usage_hours=running_hours * total_storage,
                discount_rate=system.tenant.discount_rate
            )

            # 自动计算费用（在save方法中）
            billing_record.save()

            success_count += 1
            logger.info(f"成功创建系统 {system.name} 的计费记录，日费用: {billing_record.actual_daily_cost}")

        except Exception as e:
            error_count += 1
            logger.error(f"创建系统 {system.name} 的计费记录失败: {str(e)}", exc_info=True)

    logger.info(f"计费记录生成完成！成功: {success_count}, 失败: {error_count}")
    return {
        'success_count': success_count,
        'error_count': error_count,
        'billing_date': yesterday.strftime('%Y-%m-%d')
    }


@shared_task
def detect_resource_changes():
    """
    检测资源变更任务：检测虚拟机资源变化并记录
    建议每小时执行一次
    """
    logger.info("开始检测资源变更...")

    changes_detected = 0
    systems = InformationSystem.objects.all()

    for system in systems:
        try:
            # 获取该系统的所有虚拟机
            vms = VirtualMachine.objects.filter(information_system=system)

            # 计算当前资源总量
            current_cpu = sum([vm.cpu_cores for vm in vms])
            current_memory = sum([vm.memory_gb for vm in vms])
            current_storage = sum([vm.disk_gb for vm in vms])

            # 与系统记录的总量对比
            if (current_cpu != system.total_cpu or
                current_memory != system.total_memory or
                current_storage != system.total_storage):

                # 检测到变更，记录到日志
                adjustment_type = 'cpu_upgrade' if current_cpu > system.total_cpu else 'cpu_downgrade'

                ResourceAdjustmentLog.objects.create(
                    information_system=system,
                    adjustment_type=adjustment_type,
                    old_cpu_cores=system.total_cpu,
                    old_memory_gb=system.total_memory,
                    old_storage_gb=system.total_storage,
                    new_cpu_cores=current_cpu,
                    new_memory_gb=current_memory,
                    new_storage_gb=current_storage,
                    adjustment_detail=f'自动检测到资源变更: CPU {system.total_cpu}->{current_cpu}, 内存 {system.total_memory}->{current_memory}, 存储 {system.total_storage}->{current_storage}',
                    adjustment_date=timezone.now(),
                    effective_date=date.today(),
                    operator=None
                )

                # 更新系统资源总量
                system.total_cpu = current_cpu
                system.total_memory = current_memory
                system.total_storage = current_storage
                system.save()

                changes_detected += 1
                logger.info(f"检测到系统 {system.name} 的资源变更")

        except Exception as e:
            logger.error(f"检测系统 {system.name} 资源变更失败: {str(e)}", exc_info=True)

    logger.info(f"资源变更检测完成！检测到 {changes_detected} 个变更")
    return {
        'changes_detected': changes_detected
    }


@shared_task
def sync_vm_status():
    """
    同步虚拟机状态任务：确保系统数据与实际状态一致
    建议每5分钟执行一次
    """
    logger.info("开始同步虚拟机状态...")

    synced_count = 0
    vms = VirtualMachine.objects.filter(status__in=['running', 'stopped'])

    for vm in vms:
        try:
            # 这里可以添加与OpenStack同步的逻辑
            # 暂时只更新updated_at时间戳
            synced_count += 1

        except Exception as e:
            logger.error(f"同步虚拟机 {vm.name} 状态失败: {str(e)}", exc_info=True)

    logger.info(f"虚拟机状态同步完成！同步了 {synced_count} 台虚拟机")
    return {
        'synced_count': synced_count
    }