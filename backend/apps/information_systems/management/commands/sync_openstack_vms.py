"""
Django管理命令：从OpenStack全面同步虚拟机数据
包括规格、状态、IP地址、启动时间等
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.information_systems.models import VirtualMachine
from apps.openstack.services import get_openstack_service
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '从OpenStack全面同步所有虚拟机数据（规格、状态、IP、启动时间等）'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅显示会更新的内容，不实际更新数据库',
        )
        parser.add_argument(
            '--create-missing',
            action='store_true',
            help='为OpenStack中存在但数据库中没有的虚拟机创建记录',
        )
        parser.add_argument(
            '--cleanup-deleted',
            action='store_true',
            help='删除OpenStack中已不存在的虚拟机记录',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        create_missing = options.get('create_missing', False)
        cleanup_deleted = options.get('cleanup_deleted', False)
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN 模式 - 不会实际更新数据库'))
        
        if cleanup_deleted:
            self.stdout.write(self.style.NOTICE('启用清理模式 - 将删除OpenStack中不存在的虚拟机记录'))
        
        openstack_service = get_openstack_service()
        
        # 获取所有有 openstack_id 的虚拟机
        vms = VirtualMachine.objects.exclude(openstack_id__isnull=True).exclude(openstack_id='')
        self.stdout.write(f'找到 {vms.count()} 个已绑定 OpenStack 的虚拟机\n')
        
        updated_count = 0
        not_found_count = 0
        deleted_count = 0
        error_count = 0
        
        for vm in vms:
            try:
                # 从 OpenStack 获取虚拟机详情
                server_info = openstack_service.get_server(vm.openstack_id)
                
                if not server_info:
                    not_found_count += 1
                    
                    if cleanup_deleted:
                        self.stdout.write(
                            self.style.WARNING(
                                f'⚠ 虚拟机 {vm.name} (ID: {vm.openstack_id}) 在 OpenStack 中未找到 → 将删除数据库记录'
                            )
                        )
                        if not dry_run:
                            vm.delete()
                            deleted_count += 1
                            self.stdout.write(self.style.SUCCESS(f'  ✓ 已删除数据库记录'))
                        else:
                            self.stdout.write(self.style.WARNING(f'  → 将删除（dry-run）'))
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f'⚠ 虚拟机 {vm.name} (ID: {vm.openstack_id}) 在 OpenStack 中未找到（使用 --cleanup-deleted 可自动删除）'
                            )
                        )
                    continue
                
                changes = []
                
                # 1. 同步规格信息
                flavor_id = server_info.get('flavor', {}).get('id')
                if flavor_id:
                    flavor = openstack_service.get_flavor(flavor_id)
                    if flavor:
                        actual_vcpus = flavor.get('vcpus', 0)
                        actual_ram_mb = flavor.get('ram', 0)
                        actual_ram_gb = int(actual_ram_mb / 1024)
                        actual_disk = flavor.get('disk', 0)
                        
                        if vm.cpu_cores != actual_vcpus:
                            changes.append(f'CPU: {vm.cpu_cores}核 → {actual_vcpus}核')
                            if not dry_run:
                                vm.cpu_cores = actual_vcpus
                        
                        if vm.memory_gb != actual_ram_gb:
                            changes.append(f'内存: {vm.memory_gb}GB → {actual_ram_gb}GB')
                            if not dry_run:
                                vm.memory_gb = actual_ram_gb
                        
                        if vm.disk_gb != actual_disk:
                            changes.append(f'磁盘: {vm.disk_gb}GB → {actual_disk}GB')
                            if not dry_run:
                                vm.disk_gb = actual_disk
                
                # 获取 OpenStack 中的真实启动时间
                os_launch_time = None
                if server_info.get('launched_at'):
                    # OpenStack 返回的启动时间
                    from dateutil.parser import parse
                    os_launch_time = parse(server_info['launched_at'])
                elif server_info.get('created_at'):
                    # 如果没有 launched_at，使用创建时间
                    from dateutil.parser import parse
                    os_launch_time = parse(server_info['created_at'])
                
                # 2. 同步状态
                openstack_status = server_info.get('status', '').upper()
                new_status = vm.status  # 默认保持不变
                
                if openstack_status == 'ACTIVE':
                    new_status = VirtualMachine.VMStatus.RUNNING
                elif openstack_status == 'SHUTOFF':
                    new_status = VirtualMachine.VMStatus.STOPPED
                elif openstack_status == 'ERROR':
                    new_status = VirtualMachine.VMStatus.ERROR
                elif openstack_status == 'PAUSED':
                    new_status = VirtualMachine.VMStatus.PAUSED
                
                if vm.status != new_status:
                    changes.append(f'状态: {vm.get_status_display()} → {dict(VirtualMachine.VMStatus.choices)[new_status]}')
                    if not dry_run:
                        vm.status = new_status
                        # 如果变为运行状态且有OpenStack启动时间，设置start时间
                        if new_status == VirtualMachine.VMStatus.RUNNING and os_launch_time and not vm.last_start_time:
                            vm.last_start_time = os_launch_time
                            changes.append(f'设置启动时间: {os_launch_time.strftime("%Y-%m-%d %H:%M:%S")}')
                
                # 修复：即使状态没变，如果是运行中但没有启动时间，使用OpenStack的启动时间
                elif new_status == VirtualMachine.VMStatus.RUNNING and not vm.last_start_time:
                    if os_launch_time:
                        changes.append(f'设置真实启动时间: {os_launch_time.strftime("%Y-%m-%d %H:%M:%S")}（从OpenStack获取）')
                        if not dry_run:
                            vm.last_start_time = os_launch_time
                    else:
                        # 如果OpenStack也没有启动时间，使用当前时间作为fallback
                        changes.append(f'设置启动时间: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}（OpenStack无数据，使用当前时间）')
                        if not dry_run:
                            vm.last_start_time = timezone.now()
                
                # 3. 同步IP地址
                addresses = server_info.get('addresses', {})
                if addresses:
                    for network_name, addr_list in addresses.items():
                        if addr_list and len(addr_list) > 0:
                            new_ip = addr_list[0].get('addr')
                            if new_ip and vm.ip_address != new_ip:
                                changes.append(f'IP: {vm.ip_address or "无"} → {new_ip}')
                                if not dry_run:
                                    vm.ip_address = new_ip
                                    if 'OS-EXT-IPS-MAC:mac_addr' in addr_list[0]:
                                        vm.mac_address = addr_list[0].get('OS-EXT-IPS-MAC:mac_addr')
                            break
                
                # 如果有变更，显示并保存
                if changes:
                    self.stdout.write(self.style.SUCCESS(f'\n✓ {vm.name}:'))
                    for change in changes:
                        self.stdout.write(f'  • {change}')
                    
                    if not dry_run:
                        vm.save()
                        updated_count += 1
                    else:
                        updated_count += 1
                        
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ 处理虚拟机 {vm.name} 时出错: {str(e)}'
                    )
                )
                logger.exception(f'同步虚拟机 {vm.name} 失败')
        
        # 输出摘要
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('\n同步完成:'))
        self.stdout.write(f'  总计: {vms.count()} 个虚拟机')
        if dry_run:
            self.stdout.write(f'  将更新: {updated_count} 个')
            if cleanup_deleted and deleted_count > 0:
                self.stdout.write(f'  将删除: {deleted_count} 个')
        else:
            self.stdout.write(self.style.SUCCESS(f'  已更新: {updated_count} 个'))
            if cleanup_deleted and deleted_count > 0:
                self.stdout.write(self.style.SUCCESS(f'  已删除: {deleted_count} 个'))
        self.stdout.write(self.style.WARNING(f'  未找到: {not_found_count} 个'))
        self.stdout.write(self.style.ERROR(f'  错误: {error_count} 个'))
        self.stdout.write('='*60 + '\n')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '\n提示: 使用不带 --dry-run 参数的命令来实际更新数据库'
                )
            )
