"""
信息系统管理定时任务
"""

from celery import shared_task
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
import logging

from .models import InformationSystem, VirtualMachine, DailyBillingRecord, ResourceAdjustmentLog, VMOperationLog
from ..openstack.services import get_openstack_service

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
    同步虚拟机状态任务：从 OpenStack 同步真实状态
    建议每5分钟执行一次
    """
    logger.info("开始同步虚拟机状态...")

    synced_count = 0
    updated_count = 0
    error_count = 0

    # 获取所有有 OpenStack ID 的虚拟机
    vms = VirtualMachine.objects.exclude(openstack_id__isnull=True).exclude(openstack_id='')

    try:
        openstack_service = get_openstack_service()

        for vm in vms:
            try:
                # 从 OpenStack 获取虚拟机最新信息
                server_info = openstack_service.get_server(vm.openstack_id)

                if not server_info:
                    logger.warning(f"在 OpenStack 中未找到虚拟机: {vm.name} ({vm.openstack_id})")
                    # 虚拟机在 OpenStack 中不存在，标记为错误状态
                    if vm.status != VirtualMachine.VMStatus.ERROR:
                        vm.status = VirtualMachine.VMStatus.ERROR
                        vm.save()

                        VMOperationLog.objects.create(
                            virtual_machine=vm,
                            operation_type='sync',
                            operator=None,
                            operation_detail=f'同步状态失败：在 OpenStack 中未找到虚拟机',
                            success=False
                        )
                        updated_count += 1
                    continue

                # 映射 OpenStack 状态到系统状态
                openstack_status = server_info.get('status', '').upper()
                old_status = vm.status

                new_status = vm.status
                if openstack_status == 'ACTIVE':
                    new_status = VirtualMachine.VMStatus.RUNNING
                elif openstack_status == 'SHUTOFF':
                    new_status = VirtualMachine.VMStatus.STOPPED
                elif openstack_status == 'PAUSED':
                    new_status = VirtualMachine.VMStatus.PAUSED
                elif openstack_status == 'ERROR':
                    new_status = VirtualMachine.VMStatus.ERROR

                # 更新 IP 地址和 MAC 地址（如果有变化）
                addresses = server_info.get('addresses', {})
                if addresses:
                    for network_name, addr_list in addresses.items():
                        if addr_list and len(addr_list) > 0:
                            new_ip = addr_list[0].get('addr')
                            if vm.ip_address != new_ip:
                                vm.ip_address = new_ip
                                logger.info(f"虚拟机 {vm.name} IP地址已更新: {new_ip}")

                            if 'OS-EXT-IPS-MAC:mac_addr' in addr_list[0]:
                                new_mac = addr_list[0].get('OS-EXT-IPS-MAC:mac_addr')
                                if vm.mac_address != new_mac:
                                    vm.mac_address = new_mac
                                    logger.info(f"虚拟机 {vm.name} MAC地址已更新: {new_mac}")
                            break

                # 如果状态有变化，更新并记录日志
                if new_status != old_status:
                    vm.status = new_status

                    # 更新启停时间
                    if new_status == VirtualMachine.VMStatus.RUNNING and old_status != VirtualMachine.VMStatus.RUNNING:
                        vm.last_start_time = timezone.now()
                    elif new_status == VirtualMachine.VMStatus.STOPPED and old_status != VirtualMachine.VMStatus.STOPPED:
                        vm.last_stop_time = timezone.now()

                    vm.save()

                    VMOperationLog.objects.create(
                        virtual_machine=vm,
                        operation_type='sync',
                        operator=None,
                        operation_detail=f'同步状态：{old_status} -> {new_status}（OpenStack状态：{openstack_status}）',
                        success=True
                    )

                    updated_count += 1
                    logger.info(f"虚拟机 {vm.name} 状态已同步: {old_status} -> {new_status}")
                else:
                    # 即使状态没变化，也更新一下 updated_at 时间戳
                    vm.save(update_fields=['updated_at'])

                synced_count += 1

            except Exception as e:
                error_count += 1
                logger.error(f"同步虚拟机 {vm.name} 状态失败: {str(e)}", exc_info=True)

                VMOperationLog.objects.create(
                    virtual_machine=vm,
                    operation_type='sync',
                    operator=None,
                    operation_detail=f'同步状态失败: {str(e)}',
                    success=False
                )

    except Exception as e:
        logger.error(f"获取 OpenStack 服务失败: {str(e)}", exc_info=True)
        return {
            'synced_count': 0,
            'updated_count': 0,
            'error_count': 0,
            'error': str(e)
        }

    logger.info(f"虚拟机状态同步完成！总计: {synced_count}, 更新: {updated_count}, 错误: {error_count}")
    return {
        'synced_count': synced_count,
        'updated_count': updated_count,
        'error_count': error_count
    }