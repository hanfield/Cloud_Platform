"""
Django管理命令：从OpenStack同步虚拟机的实际规格
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.information_systems.models import VirtualMachine
from apps.openstack.services import get_openstack_service
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '从OpenStack同步所有虚拟机的实际配置（CPU、内存、磁盘）'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅显示会更新的虚拟机，不实际更新数据库',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN 模式 - 不会实际更新数据库'))
        
        # 获取所有有 openstack_id 的虚拟机
        vms = VirtualMachine.objects.exclude(openstack_id__isnull=True).exclude(openstack_id='')
        self.stdout.write(f'找到 {vms.count()} 个已绑定 OpenStack 的虚拟机')
        
        openstack_service = get_openstack_service()
        
        updated_count = 0
        not_found_count = 0
        error_count = 0
        
        for vm in vms:
            try:
                # 从 OpenStack 获取虚拟机详情
                server_info = openstack_service.get_server(vm.openstack_id)
                
                if not server_info:
                    not_found_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'虚拟机 {vm.name} (ID: {vm.openstack_id}) 在 OpenStack 中未找到'
                        )
                    )
                    continue
                
                # 获取 flavor 信息
                flavor_id = server_info.get('flavor', {}).get('id')
                if not flavor_id:
                    error_count += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f'虚拟机 {vm.name} 没有 flavor 信息'
                        )
                    )
                    continue
                
                flavor = openstack_service.get_flavor(flavor_id)
                if not flavor:
                    error_count += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f'虚拟机 {vm.name} 的 flavor {flavor_id} 未找到'
                        )
                    )
                    continue
                
                # 从 flavor 获取实际规格
                actual_vcpus = flavor.get('vcpus', 0)
                actual_ram_mb = flavor.get('ram', 0)
                actual_ram_gb = int(actual_ram_mb / 1024)
                actual_disk = flavor.get('disk', 0)
                
                # 检查是否需要更新
                needs_update = (
                    vm.cpu_cores != actual_vcpus or
                    vm.memory_gb != actual_ram_gb or
                    vm.disk_gb != actual_disk
                )
                
                if needs_update:
                    self.stdout.write(
                        self.style.NOTICE(
                            f'\n虚拟机: {vm.name}'
                        )
                    )
                    self.stdout.write(
                        f'  当前值: CPU={vm.cpu_cores}核, 内存={vm.memory_gb}GB, 磁盘={vm.disk_gb}GB'
                    )
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  实际值: CPU={actual_vcpus}核, 内存={actual_ram_gb}GB, 磁盘={actual_disk}GB'
                        )
                    )
                    self.stdout.write(
                        f'  Flavor: {flavor.get("name")} ({flavor_id})'
                    )
                    
                    if not dry_run:
                        vm.cpu_cores = actual_vcpus
                        vm.memory_gb = actual_ram_gb
                        vm.disk_gb = actual_disk
                        vm.save()
                        updated_count += 1
                        self.stdout.write(self.style.SUCCESS('  ✓ 已更新'))
                    else:
                        updated_count += 1
                        self.stdout.write(self.style.WARNING('  → 将会更新（dry-run）'))
                
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f'处理虚拟机 {vm.name} 时出错: {str(e)}'
                    )
                )
                logger.exception(f'同步虚拟机 {vm.name} 失败')
        
        # 输出摘要
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS(f'\n同步完成:'))
        self.stdout.write(f'  总计: {vms.count()} 个虚拟机')
        if dry_run:
            self.stdout.write(f'  将更新: {updated_count} 个')
        else:
            self.stdout.write(self.style.SUCCESS(f'  已更新: {updated_count} 个'))
        self.stdout.write(self.style.WARNING(f'  未找到: {not_found_count} 个'))
        self.stdout.write(self.style.ERROR(f'  错误: {error_count} 个'))
        self.stdout.write('='*60 + '\n')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '\n提示: 使用不带 --dry-run 参数的命令来实际更新数据库'
                )
            )
