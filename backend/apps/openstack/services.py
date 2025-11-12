"""
OpenStack服务集成
"""

import logging
from typing import Dict, List, Optional, Any
from django.conf import settings
import openstack
from openstack.config import cloud_region
from openstack import connection
from openstack.exceptions import SDKException

logger = logging.getLogger(__name__)


class OpenStackService:
    """OpenStack服务类"""

    def __init__(self):
        """初始化OpenStack连接"""
        self.config = settings.OPENSTACK_CONFIG
        self.connection = None
        self._connect()

    def _connect(self):
        """创建OpenStack连接"""
        try:
            # 创建连接配置
            auth_args = {
                'auth_url': self.config['AUTH_URL'],
                'username': self.config['USERNAME'],
                'password': self.config['PASSWORD'],
                'project_name': self.config['PROJECT_NAME'],
                'user_domain_name': self.config['USER_DOMAIN_NAME'],
                'project_domain_name': self.config['PROJECT_DOMAIN_NAME'],
            }

            # 创建连接
            self.connection = openstack.connect(
                auth=auth_args,
                region_name=self.config['REGION_NAME'],
                interface=self.config['INTERFACE'],
                identity_api_version=self.config['IDENTITY_API_VERSION'],
            )

            # 验证连接
            self.connection.authorize()
            logger.info("OpenStack连接成功")

        except Exception as e:
            logger.error(f"OpenStack连接失败: {str(e)}")
            raise SDKException(f"无法连接到OpenStack: {str(e)}")

    def get_connection(self) -> connection.Connection:
        """获取OpenStack连接"""
        if self.connection is None:
            self._connect()
        return self.connection

    # ==================== 项目管理 ====================

    def create_project(self, name: str, description: str = "", domain_id: str = "default") -> Dict[str, Any]:
        """创建项目"""
        try:
            conn = self.get_connection()
            project = conn.identity.create_project(
                name=name,
                description=description,
                domain_id=domain_id,
                enabled=True
            )
            logger.info(f"创建项目成功: {project.name} ({project.id})")
            return project.to_dict()
        except Exception as e:
            logger.error(f"创建项目失败: {str(e)}")
            raise SDKException(f"创建项目失败: {str(e)}")

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """获取项目信息"""
        try:
            conn = self.get_connection()
            project = conn.identity.get_project(project_id)
            return project.to_dict() if project else None
        except Exception as e:
            logger.error(f"获取项目失败: {str(e)}")
            return None

    def list_projects(self) -> List[Dict[str, Any]]:
        """列出所有项目"""
        try:
            conn = self.get_connection()
            projects = conn.identity.projects()
            return [project.to_dict() for project in projects]
        except Exception as e:
            logger.error(f"列出项目失败: {str(e)}")
            return []

    def update_project(self, project_id: str, **kwargs) -> Dict[str, Any]:
        """更新项目"""
        try:
            conn = self.get_connection()
            project = conn.identity.update_project(project_id, **kwargs)
            logger.info(f"更新项目成功: {project.name}")
            return project.to_dict()
        except Exception as e:
            logger.error(f"更新项目失败: {str(e)}")
            raise SDKException(f"更新项目失败: {str(e)}")

    def delete_project(self, project_id: str) -> bool:
        """删除项目"""
        try:
            conn = self.get_connection()
            conn.identity.delete_project(project_id)
            logger.info(f"删除项目成功: {project_id}")
            return True
        except Exception as e:
            logger.error(f"删除项目失败: {str(e)}")
            return False

    # ==================== 用户管理 ====================

    def create_user(self, name: str, password: str, email: str = "", description: str = "",
                    domain_id: str = "default") -> Dict[str, Any]:
        """创建用户"""
        try:
            conn = self.get_connection()
            user = conn.identity.create_user(
                name=name,
                password=password,
                email=email,
                description=description,
                domain_id=domain_id,
                enabled=True
            )
            logger.info(f"创建用户成功: {user.name} ({user.id})")
            return user.to_dict()
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}")
            raise SDKException(f"创建用户失败: {str(e)}")

    def list_users(self) -> List[Dict[str, Any]]:
        """列出所有用户"""
        try:
            conn = self.get_connection()
            users = conn.identity.users()
            return [user.to_dict() for user in users]
        except Exception as e:
            logger.error(f"列出用户失败: {str(e)}")
            return []

    # ==================== 实例管理 ====================

    def create_server(self, name: str, image_id: str, flavor_id: str,
                      network_ids: List[str], **kwargs) -> Dict[str, Any]:
        """创建服务器实例"""
        try:
            conn = self.get_connection()

            # 构建网络配置
            networks = [{'uuid': net_id} for net_id in network_ids]

            server = conn.compute.create_server(
                name=name,
                image_id=image_id,
                flavor_id=flavor_id,
                networks=networks,
                **kwargs
            )

            # 等待服务器创建完成
            conn.compute.wait_for_server(server)

            logger.info(f"创建服务器成功: {server.name} ({server.id})")
            return server.to_dict()
        except Exception as e:
            logger.error(f"创建服务器失败: {str(e)}")
            raise SDKException(f"创建服务器失败: {str(e)}")

    def list_servers(self, project_id: str = None) -> List[Dict[str, Any]]:
        """列出服务器实例"""
        try:
            conn = self.get_connection()
            servers = conn.compute.servers(project_id=project_id)
            return [server.to_dict() for server in servers]
        except Exception as e:
            logger.error(f"列出服务器失败: {str(e)}")
            return []

    def get_server(self, server_id: str) -> Optional[Dict[str, Any]]:
        """获取服务器详情"""
        try:
            conn = self.get_connection()
            server = conn.compute.get_server(server_id)
            return server.to_dict() if server else None
        except Exception as e:
            logger.error(f"获取服务器失败: {str(e)}")
            return None

    def delete_server(self, server_id: str) -> bool:
        """删除服务器"""
        try:
            conn = self.get_connection()
            conn.compute.delete_server(server_id)
            logger.info(f"删除服务器成功: {server_id}")
            return True
        except Exception as e:
            logger.error(f"删除服务器失败: {str(e)}")
            return False

    # ==================== 镜像管理 ====================

    def list_images(self) -> List[Dict[str, Any]]:
        """列出镜像"""
        try:
            conn = self.get_connection()
            images = conn.image.images()
            return [image.to_dict() for image in images]
        except Exception as e:
            logger.error(f"列出镜像失败: {str(e)}")
            return []

    def get_image(self, image_id: str) -> Optional[Dict[str, Any]]:
        """获取镜像详情"""
        try:
            conn = self.get_connection()
            image = conn.image.get_image(image_id)
            return image.to_dict() if image else None
        except Exception as e:
            logger.error(f"获取镜像失败: {str(e)}")
            return None

    # ==================== 规格管理 ====================

    def list_flavors(self) -> List[Dict[str, Any]]:
        """列出实例规格"""
        try:
            conn = self.get_connection()
            flavors = conn.compute.flavors()
            return [flavor.to_dict() for flavor in flavors]
        except Exception as e:
            logger.error(f"列出实例规格失败: {str(e)}")
            return []

    def get_flavor(self, flavor_id: str) -> Optional[Dict[str, Any]]:
        """获取实例规格详情"""
        try:
            conn = self.get_connection()
            flavor = conn.compute.get_flavor(flavor_id)
            return flavor.to_dict() if flavor else None
        except Exception as e:
            logger.error(f"获取实例规格失败: {str(e)}")
            return None

    # ==================== 网络管理 ====================

    def list_networks(self, project_id: str = None) -> List[Dict[str, Any]]:
        """列出网络"""
        try:
            conn = self.get_connection()
            networks = conn.network.networks(project_id=project_id)
            return [network.to_dict() for network in networks]
        except Exception as e:
            logger.error(f"列出网络失败: {str(e)}")
            return []

    def create_network(self, name: str, project_id: str = None, **kwargs) -> Dict[str, Any]:
        """创建网络"""
        try:
            conn = self.get_connection()
            network = conn.network.create_network(
                name=name,
                project_id=project_id,
                **kwargs
            )
            logger.info(f"创建网络成功: {network.name} ({network.id})")
            return network.to_dict()
        except Exception as e:
            logger.error(f"创建网络失败: {str(e)}")
            raise SDKException(f"创建网络失败: {str(e)}")

    # ==================== 配额管理 ====================

    def get_compute_quota(self, project_id: str) -> Optional[Dict[str, Any]]:
        """获取计算配额"""
        try:
            conn = self.get_connection()
            quota = conn.compute.get_quota_set(project_id)
            return quota.to_dict() if quota else None
        except Exception as e:
            logger.error(f"获取计算配额失败: {str(e)}")
            return None

    def update_compute_quota(self, project_id: str, **kwargs) -> Dict[str, Any]:
        """更新计算配额"""
        try:
            conn = self.get_connection()
            quota = conn.compute.update_quota_set(project_id, **kwargs)
            logger.info(f"更新计算配额成功: {project_id}")
            return quota.to_dict()
        except Exception as e:
            logger.error(f"更新计算配额失败: {str(e)}")
            raise SDKException(f"更新计算配额失败: {str(e)}")

    def get_network_quota(self, project_id: str) -> Optional[Dict[str, Any]]:
        """获取网络配额"""
        try:
            conn = self.get_connection()
            quota = conn.network.get_quota(project_id)
            return quota.to_dict() if quota else None
        except Exception as e:
            logger.error(f"获取网络配额失败: {str(e)}")
            return None

    # ==================== 使用统计 ====================

    def get_project_usage(self, project_id: str) -> Dict[str, Any]:
        """获取项目资源使用统计"""
        try:
            usage = {
                'servers': len(self.list_servers(project_id)),
                'networks': len(self.list_networks(project_id)),
                'compute_quota': self.get_compute_quota(project_id),
                'network_quota': self.get_network_quota(project_id),
            }
            return usage
        except Exception as e:
            logger.error(f"获取项目使用统计失败: {str(e)}")
            return {}


# 全局OpenStack服务实例
openstack_service = None


def get_openstack_service() -> OpenStackService:
    """获取OpenStack服务实例（单例模式）"""
    global openstack_service
    if openstack_service is None:
        openstack_service = OpenStackService()
    return openstack_service