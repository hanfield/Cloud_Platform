"""
OpenStack工具函数
"""

import logging
from typing import Dict, Any, Optional
from .services import get_openstack_service
from ..tenants.models import Tenant

logger = logging.getLogger(__name__)


def sync_tenant_to_openstack(tenant: Tenant) -> bool:
    """将租户同步到OpenStack"""
    try:
        service = get_openstack_service()

        # 如果租户还没有对应的OpenStack项目，创建一个
        if not tenant.openstack_project_id:
            project_data = service.create_project(
                name=tenant.code,
                description=f"租户: {tenant.name}"
            )
            tenant.openstack_project_id = project_data['id']
            tenant.save()

            logger.info(f"为租户 {tenant.name} 创建OpenStack项目: {project_data['id']}")

        # 同步配额设置
        sync_tenant_quotas(tenant)

        return True

    except Exception as e:
        logger.error(f"同步租户到OpenStack失败: {str(e)}")
        return False


def sync_tenant_quotas(tenant: Tenant) -> bool:
    """同步租户配额到OpenStack"""
    try:
        if not tenant.openstack_project_id:
            logger.warning(f"租户 {tenant.name} 没有对应的OpenStack项目ID")
            return False

        service = get_openstack_service()

        # 更新计算配额
        compute_quota = {
            'instances': tenant.quota_instances,
            'cores': tenant.quota_vcpus,
            'ram': tenant.quota_memory * 1024,  # 转换为MB
        }

        service.update_compute_quota(tenant.openstack_project_id, **compute_quota)

        # 更新网络配额（如果支持的话）
        # network_quota = {
        #     'network': tenant.quota_networks,
        #     'floatingip': tenant.quota_floating_ips,
        # }
        # service.update_network_quota(tenant.openstack_project_id, **network_quota)

        logger.info(f"同步租户 {tenant.name} 配额到OpenStack成功")
        return True

    except Exception as e:
        logger.error(f"同步租户配额失败: {str(e)}")
        return False


def get_tenant_resource_usage(tenant: Tenant) -> Optional[Dict[str, Any]]:
    """获取租户资源使用情况"""
    try:
        if not tenant.openstack_project_id:
            return None

        service = get_openstack_service()
        usage = service.get_project_usage(tenant.openstack_project_id)

        return usage

    except Exception as e:
        logger.error(f"获取租户资源使用情况失败: {str(e)}")
        return None


def create_tenant_resources(tenant: Tenant, resources_config: Dict[str, Any]) -> bool:
    """为租户创建资源"""
    try:
        if not tenant.openstack_project_id:
            logger.warning(f"租户 {tenant.name} 没有对应的OpenStack项目ID")
            return False

        service = get_openstack_service()

        # 创建网络（如果需要）
        if resources_config.get('create_network'):
            network_name = f"{tenant.code}-network"
            network_data = service.create_network(
                name=network_name,
                project_id=tenant.openstack_project_id
            )
            logger.info(f"为租户 {tenant.name} 创建网络: {network_data['id']}")

        # 创建实例（如果需要）
        if resources_config.get('create_instances'):
            instances_config = resources_config['create_instances']
            for instance_config in instances_config:
                server_data = service.create_server(
                    name=instance_config['name'],
                    image_id=instance_config['image_id'],
                    flavor_id=instance_config['flavor_id'],
                    network_ids=instance_config['network_ids']
                )
                logger.info(f"为租户 {tenant.name} 创建实例: {server_data['id']}")

        return True

    except Exception as e:
        logger.error(f"为租户创建资源失败: {str(e)}")
        return False


def delete_tenant_resources(tenant: Tenant) -> bool:
    """删除租户的所有资源"""
    try:
        if not tenant.openstack_project_id:
            return True  # 没有OpenStack项目，认为删除成功

        service = get_openstack_service()

        # 删除所有实例
        servers = service.list_servers(tenant.openstack_project_id)
        for server in servers:
            service.delete_server(server['id'])
            logger.info(f"删除租户 {tenant.name} 的实例: {server['id']}")

        # 删除项目
        service.delete_project(tenant.openstack_project_id)
        logger.info(f"删除租户 {tenant.name} 的OpenStack项目: {tenant.openstack_project_id}")

        return True

    except Exception as e:
        logger.error(f"删除租户资源失败: {str(e)}")
        return False


def validate_openstack_connection() -> bool:
    """验证OpenStack连接"""
    try:
        service = get_openstack_service()
        # 尝试获取项目列表来验证连接
        projects = service.list_projects()
        logger.info(f"OpenStack连接验证成功，找到 {len(projects)} 个项目")
        return True
    except Exception as e:
        logger.error(f"OpenStack连接验证失败: {str(e)}")
        return False


def get_openstack_resources_summary() -> Dict[str, Any]:
    """获取OpenStack资源总览"""
    try:
        service = get_openstack_service()

        # 获取基础信息
        projects = service.list_projects()
        images = service.list_images()
        flavors = service.list_flavors()
        networks = service.list_networks()
        servers = service.list_servers()

        summary = {
            'projects_count': len(projects),
            'images_count': len(images),
            'flavors_count': len(flavors),
            'networks_count': len(networks),
            'servers_count': len(servers),
            'projects': projects[:10],  # 只返回前10个项目
            'images': images[:10],  # 只返回前10个镜像
            'flavors': flavors[:10],  # 只返回前10个规格
        }

        return summary

    except Exception as e:
        logger.error(f"获取OpenStack资源总览失败: {str(e)}")
        return {}


def format_resource_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """格式化资源数据"""
    if not data:
        return {}

    # 移除一些不必要的字段
    excluded_fields = ['links', 'location', 'properties']
    formatted_data = {}

    for key, value in data.items():
        if key not in excluded_fields:
            formatted_data[key] = value

    return formatted_data


def sync_openstack_vms_to_db() -> Dict[str, int]:
    """同步OpenStack虚拟机到本地数据库"""
    from apps.information_systems.models import VirtualMachine, InformationSystem
    from django.contrib.auth.models import User
    from django.utils import timezone
    from datetime import timedelta
    
    result = {'synced': 0, 'created': 0, 'updated': 0}
    
    try:
        service = get_openstack_service()
        servers = service.list_servers()
        logger.info(f"从 OpenStack 获取到 {len(servers)} 台虚拟机")
        
        # 获取或创建默认租户和系统
        admin_user = User.objects.filter(username='admin').first() or User.objects.first()
        
        tenant, _ = Tenant.objects.get_or_create(
            name='OpenStack导入租户',
            defaults={
                'code': 'OPENSTACK_IMPORT',
                'description': '用于存放从OpenStack导入的资源',
                'contact_person': 'Admin',
                'contact_phone': '13800000000',
                'contact_email': 'admin@example.com',
                'status': 'active',
                'start_time': timezone.now(),
                'end_time': timezone.now() + timedelta(days=3650)  # 10年有效期
            }
        )
        
        default_system, _ = InformationSystem.objects.get_or_create(
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
                cpu = 2
                ram = 4
                disk = 100
                
                # 方法1：尝试从服务器信息中直接获取 flavor 详情（某些 OpenStack 配置会返回完整 flavor 信息）
                if 'vcpus' in flavor:
                    cpu = flavor.get('vcpus', 2)
                    ram = int(flavor.get('ram', 4096) / 1024)
                    disk = flavor.get('disk', 100)
                    logger.info(f"从服务器 flavor 对象获取配置: {server['name']} - {cpu}C/{ram}GB/{disk}GB")
                # 方法2：通过 flavor ID 查询（如果 flavor 仍然存在）
                elif flavor.get('id'):
                    flavor_id = flavor.get('id')
                    try:
                        flavor_detail = service.get_flavor(flavor_id)
                        if flavor_detail:
                            cpu = flavor_detail.get('vcpus', 2)
                            ram = int(flavor_detail.get('ram', 4096) / 1024)
                            disk = flavor_detail.get('disk', 100)
                            logger.info(f"从 flavor API 获取配置: {server['name']} - {cpu}C/{ram}GB/{disk}GB")
                        else:
                            logger.warning(f"Flavor {flavor_id} 不存在，使用默认配置: {server['name']}")
                    except Exception as e:
                        logger.warning(f"获取 flavor {flavor_id} 失败，使用默认配置: {str(e)}")

                
                # 获取网络信息
                addresses = server.get('addresses', {})
                ip_address = None
                for net_name, ips in addresses.items():
                    for ip in ips:
                        if ip.get('version') == 4:
                            ip_address = ip.get('addr')
                            break
                    if ip_address:
                        break
                
                # 查找或创建本地记录
                vm = VirtualMachine.objects.filter(openstack_id=server['id']).first()
                
                if vm:
                    vm.name = server['name']
                    vm.status = vm_status
                    vm.cpu_cores = cpu
                    vm.memory_gb = ram
                    vm.disk_gb = disk
                    vm.ip_address = ip_address
                    vm.save()
                    result['updated'] += 1
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
                        created_by=admin_user,
                        data_center_type=VirtualMachine.DataCenterType.PRODUCTION
                    )
                    result['created'] += 1
                
                result['synced'] += 1
                
            except Exception as e:
                logger.error(f"同步虚拟机 {server.get('name')} 失败: {str(e)}")
        
        return result
        
    except Exception as e:
        logger.error(f"同步OpenStack虚拟机失败: {str(e)}")
        return result