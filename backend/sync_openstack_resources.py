"""
同步 OpenStack 资源到本地数据库
"""
import os
import sys
import django
import logging
from datetime import datetime

# 设置 Django 环境
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')
django.setup()

from apps.openstack.services import get_openstack_service
from apps.information_systems.models import VirtualMachine, InformationSystem
from apps.tenants.models import Tenant
from django.contrib.auth.models import User

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_or_create_default_tenant_and_system():
    """获取或创建默认租户和信息系统"""
    # 1. 获取或创建默认管理员用户
    admin_user = User.objects.filter(username='admin').first()
    if not admin_user:
        logger.warning("未找到 admin 用户，将使用第一个可用用户")
        admin_user = User.objects.first()
        
    # 2. 获取或创建默认租户
    tenant, created = Tenant.objects.get_or_create(
        name='OpenStack导入租户',
        defaults={
            'code': 'OPENSTACK_IMPORT',
            'description': '用于存放从OpenStack导入的资源',
            'contact_person': 'Admin',
            'contact_phone': '13800000000',
            'email': 'admin@example.com',
            'status': 'active'
        }
    )
    if created:
        logger.info(f"创建默认租户: {tenant.name}")
        
    # 3. 获取或创建默认信息系统
    system, created = InformationSystem.objects.get_or_create(
        name='OpenStack导入系统',
        defaults={
            'code': 'OS_IMPORT_SYS',
            'description': '用于存放从OpenStack导入的资源',
            'system_type': InformationSystem.SystemType.OTHER,
            'status': InformationSystem.Status.RUNNING,
            'tenant': tenant,
            'created_by': admin_user
        }
    )
    if created:
        logger.info(f"创建默认信息系统: {system.name}")
        
    return system, admin_user

def sync_vms():
    """同步虚拟机"""
    logger.info("开始同步虚拟机...")
    
    try:
        service = get_openstack_service()
        servers = service.list_servers()
        logger.info(f"从 OpenStack 获取到 {len(servers)} 台虚拟机")
        
        default_system, default_user = get_or_create_default_tenant_and_system()
        
        synced_count = 0
        created_count = 0
        updated_count = 0
        
        for server in servers:
            try:
                # 转换状态
                status_map = {
                    'ACTIVE': VirtualMachine.VMStatus.RUNNING,
                    'SHUTOFF': VirtualMachine.VMStatus.STOPPED,
                    'PAUSED': VirtualMachine.VMStatus.PAUSED,
                    'ERROR': VirtualMachine.VMStatus.ERROR
                }
                vm_status = status_map.get(server.get('status'), VirtualMachine.VMStatus.STOPPED)
                
                # 获取规格信息
                flavor = server.get('flavor', {})
                # 注意：这里可能需要再次调用 get_flavor 获取详细信息，因为 list_servers 返回的 flavor 可能只有 id
                flavor_id = flavor.get('id')
                cpu = 2
                ram = 4
                disk = 100
                
                if flavor_id:
                    flavor_detail = service.get_flavor(flavor_id)
                    if flavor_detail:
                        cpu = flavor_detail.get('vcpus', 2)
                        ram = int(flavor_detail.get('ram', 4096) / 1024)
                        disk = flavor_detail.get('disk', 100)
                
                # 获取网络信息
                addresses = server.get('addresses', {})
                ip_address = None
                # 尝试获取第一个IP
                for net_name, ips in addresses.items():
                    for ip in ips:
                        if ip.get('version') == 4:
                            ip_address = ip.get('addr')
                            break
                    if ip_address:
                        break
                
                # 查找或创建本地记录
                # 注意：如果记录已存在，我们只更新状态和资源信息，不覆盖所属系统
                vm = VirtualMachine.objects.filter(openstack_id=server['id']).first()
                
                if vm:
                    vm.name = server['name']
                    vm.status = vm_status
                    vm.cpu_cores = cpu
                    vm.memory_gb = ram
                    vm.disk_gb = disk
                    vm.ip_address = ip_address
                    vm.save()
                    updated_count += 1
                    logger.info(f"更新虚拟机: {server['name']} ({server['id']})")
                else:
                    VirtualMachine.objects.create(
                        openstack_id=server['id'],
                        name=server['name'],
                        information_system=default_system,
                        status=vm_status,
                        cpu_cores=cpu,
                        memory_gb=ram,
                        disk_gb=disk,
                        ip_address=ip_address,
                        created_by=default_user,
                        data_center_type=VirtualMachine.DataCenterType.PRODUCTION
                    )
                    created_count += 1
                    logger.info(f"导入新虚拟机: {server['name']} ({server['id']})")
                
                synced_count += 1
                
            except Exception as e:
                logger.error(f"同步虚拟机 {server.get('name')} 失败: {str(e)}")
        
        logger.info(f"同步完成! 总计: {synced_count}, 新增: {created_count}, 更新: {updated_count}")
        return True
        
    except Exception as e:
        logger.error(f"同步过程发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    sync_vms()
