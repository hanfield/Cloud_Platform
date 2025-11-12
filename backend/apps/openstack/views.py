"""
OpenStack集成视图
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from django.shortcuts import get_object_or_404

from .services import get_openstack_service
from .utils import (
    sync_tenant_to_openstack,
    get_tenant_resource_usage,
    validate_openstack_connection,
    get_openstack_resources_summary,
    format_resource_data,
    create_tenant_resources,
    delete_tenant_resources
)
from apps.tenants.models import Tenant

logger = logging.getLogger(__name__)


class OpenStackResourceViewSet(ViewSet):
    """OpenStack资源管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """获取OpenStack资源总览"""
        try:
            summary = get_openstack_resources_summary()
            return Response(summary)
        except Exception as e:
            logger.error(f"获取OpenStack资源总览失败: {str(e)}")
            return Response(
                {'error': f'获取资源总览失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OpenStackProjectViewSet(ViewSet):
    """OpenStack项目管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出所有项目"""
        try:
            service = get_openstack_service()
            projects = service.list_projects()
            formatted_projects = [format_resource_data(project) for project in projects]
            return Response(formatted_projects)
        except Exception as e:
            logger.error(f"列出项目失败: {str(e)}")
            return Response(
                {'error': f'列出项目失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取项目详情"""
        try:
            service = get_openstack_service()
            project = service.get_project(pk)
            if project:
                return Response(format_resource_data(project))
            else:
                return Response(
                    {'error': '项目不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取项目详情失败: {str(e)}")
            return Response(
                {'error': f'获取项目详情失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建项目"""
        try:
            service = get_openstack_service()
            data = request.data

            project = service.create_project(
                name=data.get('name'),
                description=data.get('description', ''),
                domain_id=data.get('domain_id', 'default')
            )

            return Response(format_resource_data(project), status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建项目失败: {str(e)}")
            return Response(
                {'error': f'创建项目失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class OpenStackServerViewSet(ViewSet):
    """OpenStack服务器管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出服务器"""
        try:
            service = get_openstack_service()
            project_id = request.query_params.get('project_id')
            servers = service.list_servers(project_id)
            formatted_servers = [format_resource_data(server) for server in servers]
            return Response(formatted_servers)
        except Exception as e:
            logger.error(f"列出服务器失败: {str(e)}")
            return Response(
                {'error': f'列出服务器失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取服务器详情"""
        try:
            service = get_openstack_service()
            server = service.get_server(pk)
            if server:
                return Response(format_resource_data(server))
            else:
                return Response(
                    {'error': '服务器不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取服务器详情失败: {str(e)}")
            return Response(
                {'error': f'获取服务器详情失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建服务器"""
        try:
            service = get_openstack_service()
            data = request.data

            server = service.create_server(
                name=data.get('name'),
                image_id=data.get('image_id'),
                flavor_id=data.get('flavor_id'),
                network_ids=data.get('network_ids', [])
            )

            return Response(format_resource_data(server), status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建服务器失败: {str(e)}")
            return Response(
                {'error': f'创建服务器失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, pk=None):
        """删除服务器"""
        try:
            service = get_openstack_service()
            success = service.delete_server(pk)
            if success:
                return Response({'detail': '服务器删除成功'})
            else:
                return Response(
                    {'error': '删除服务器失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"删除服务器失败: {str(e)}")
            return Response(
                {'error': f'删除服务器失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OpenStackImageViewSet(ViewSet):
    """OpenStack镜像管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出镜像"""
        try:
            service = get_openstack_service()
            images = service.list_images()
            formatted_images = [format_resource_data(image) for image in images]
            return Response(formatted_images)
        except Exception as e:
            logger.error(f"列出镜像失败: {str(e)}")
            return Response(
                {'error': f'列出镜像失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取镜像详情"""
        try:
            service = get_openstack_service()
            image = service.get_image(pk)
            if image:
                return Response(format_resource_data(image))
            else:
                return Response(
                    {'error': '镜像不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取镜像详情失败: {str(e)}")
            return Response(
                {'error': f'获取镜像详情失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OpenStackFlavorViewSet(ViewSet):
    """OpenStack规格管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出规格"""
        try:
            service = get_openstack_service()
            flavors = service.list_flavors()
            formatted_flavors = [format_resource_data(flavor) for flavor in flavors]
            return Response(formatted_flavors)
        except Exception as e:
            logger.error(f"列出规格失败: {str(e)}")
            return Response(
                {'error': f'列出规格失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取规格详情"""
        try:
            service = get_openstack_service()
            flavor = service.get_flavor(pk)
            if flavor:
                return Response(format_resource_data(flavor))
            else:
                return Response(
                    {'error': '规格不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取规格详情失败: {str(e)}")
            return Response(
                {'error': f'获取规格详情失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OpenStackNetworkViewSet(ViewSet):
    """OpenStack网络管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出网络"""
        try:
            service = get_openstack_service()
            project_id = request.query_params.get('project_id')
            networks = service.list_networks(project_id)
            formatted_networks = [format_resource_data(network) for network in networks]
            return Response(formatted_networks)
        except Exception as e:
            logger.error(f"列出网络失败: {str(e)}")
            return Response(
                {'error': f'列出网络失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建网络"""
        try:
            service = get_openstack_service()
            data = request.data

            network = service.create_network(
                name=data.get('name'),
                project_id=data.get('project_id')
            )

            return Response(format_resource_data(network), status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建网络失败: {str(e)}")
            return Response(
                {'error': f'创建网络失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_connection(request):
    """检查OpenStack连接状态"""
    try:
        is_connected = validate_openstack_connection()
        return Response({
            'connected': is_connected,
            'message': 'OpenStack连接正常' if is_connected else 'OpenStack连接失败'
        })
    except Exception as e:
        logger.error(f"检查OpenStack连接失败: {str(e)}")
        return Response({
            'connected': False,
            'message': f'连接检查失败: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_tenant(request, tenant_id):
    """同步租户到OpenStack"""
    try:
        tenant = get_object_or_404(Tenant, id=tenant_id)

        success = sync_tenant_to_openstack(tenant)
        if success:
            return Response({
                'success': True,
                'message': f'租户 {tenant.name} 同步成功',
                'openstack_project_id': tenant.openstack_project_id
            })
        else:
            return Response({
                'success': False,
                'message': f'租户 {tenant.name} 同步失败'
            }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"同步租户失败: {str(e)}")
        return Response(
            {'error': f'同步租户失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_usage(request, tenant_id):
    """获取租户资源使用情况"""
    try:
        tenant = get_object_or_404(Tenant, id=tenant_id)

        usage = get_tenant_resource_usage(tenant)
        if usage:
            return Response(usage)
        else:
            return Response({
                'error': '无法获取资源使用情况'
            }, status=status.HTTP_404_NOT_FOUND)

    except Exception as e:
        logger.error(f"获取租户资源使用情况失败: {str(e)}")
        return Response(
            {'error': f'获取资源使用情况失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_tenant_resources_view(request, tenant_id):
    """为租户创建资源"""
    try:
        tenant = get_object_or_404(Tenant, id=tenant_id)
        resources_config = request.data

        success = create_tenant_resources(tenant, resources_config)
        if success:
            return Response({
                'success': True,
                'message': f'为租户 {tenant.name} 创建资源成功'
            })
        else:
            return Response({
                'success': False,
                'message': f'为租户 {tenant.name} 创建资源失败'
            }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.error(f"创建租户资源失败: {str(e)}")
        return Response(
            {'error': f'创建租户资源失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )