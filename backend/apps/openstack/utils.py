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