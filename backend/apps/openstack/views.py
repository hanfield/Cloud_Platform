"""
OpenStack集成视图
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, action
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
from ..tenants.models import Tenant
from apps.information_systems.models import VirtualMachine

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
            
            # 只有管理员可以查询所有租户的虚拟机
            all_tenants = request.query_params.get('all_tenants', 'false').lower() == 'true'
            if all_tenants and not request.user.is_staff:
                all_tenants = False
                
            servers = service.list_servers(project_id, all_tenants=all_tenants)
            formatted_servers = [format_resource_data(server) for server in servers]
            
            # 【混合模式】添加数据库 ID 映射
            # 批量查询数据库中的 VM 记录，提供快照和监控功能支持
            try:
                openstack_ids = [s['id'] for s in formatted_servers]
                
                # 批量查询，性能优化
                db_vms = VirtualMachine.objects.filter(
                    openstack_id__in=openstack_ids
                ).values('id', 'openstack_id')
                
                # 创建 openstack_id -> database_id 映射
                id_mapping = {str(vm['openstack_id']): str(vm['id']) for vm in db_vms}
                
                # 将 database_id 添加到每个服务器
                for server in formatted_servers:
                    server['database_id'] = id_mapping.get(server['id'])
                    
                logger.info(f"Mapped {len(id_mapping)}/{len(formatted_servers)} servers to database IDs")
            except Exception as mapping_error:
                logger.warning(f"Failed to map database IDs: {str(mapping_error)}")
                # 映射失败不影响基本功能，继续返回数据
            
            # 【混合模式】添加租户名称和系统名称映射
            # 通过 VirtualMachine → InformationSystem → Tenant 关系链获取
            try:
                from apps.tenants.models import Tenant
                
                # 批量查询数据库中的 VM 及其关联的信息系统和租户
                db_vms = VirtualMachine.objects.filter(
                    openstack_id__in=[s['id'] for s in formatted_servers]
                ).select_related('information_system', 'information_system__tenant').values(
                    'openstack_id', 
                    'information_system__name',
                    'information_system__tenant__name'
                )
                
                # 创建映射
                vm_tenant_mapping = {}
                for vm in db_vms:
                    vm_tenant_mapping[vm['openstack_id']] = {
                        'system_name': vm['information_system__name'],
                        'tenant_name': vm['information_system__tenant__name']
                    }
                
                # 将租户名称和系统名称添加到每个服务器
                for server in formatted_servers:
                    sid = server['id']
                    if sid in vm_tenant_mapping:
                        server['tenant_name'] = vm_tenant_mapping[sid]['tenant_name']
                        server['system_name'] = vm_tenant_mapping[sid]['system_name']
                    else:
                        server['tenant_name'] = None
                        server['system_name'] = None
                        
                logger.info(f"Mapped tenant/system for {len(vm_tenant_mapping)}/{len(formatted_servers)} servers")
            except Exception as tenant_error:
                logger.warning(f"Failed to map tenant names: {str(tenant_error)}")
            
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

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """启动VM"""
        try:
            service = get_openstack_service()
            success = service.start_server(pk)
            if success:
                # 立即同步VM状态到数据库
                self._sync_vm_status_from_openstack(pk)
                return Response({'detail': '服务器启动成功'})
            else:
                return Response(
                    {'error': '启动服务器失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"启动服务器失败: {str(e)}")
            return Response(
                {'error': f'启动服务器失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """停止VM"""
        try:
            service = get_openstack_service()
            success = service.stop_server(pk)
            if success:
                # 立即同步VM状态到数据库
                self._sync_vm_status_from_openstack(pk)
                return Response({'detail': '服务器停止成功'})
            else:
                return Response(
                    {'error': '停止服务器失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"停止服务器失败: {str(e)}")
            return Response(
                {'error': f'停止服务器失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def reboot(self, request, pk=None):
        """重启VM"""
        try:
            service = get_openstack_service()
            reboot_type = request.data.get('type', 'SOFT')  # SOFT 或 HARD
            success = service.reboot_server(pk, reboot_type)
            if success:
                # 重启后稍等片刻再同步状态
                import time
                time.sleep(1)
                self._sync_vm_status_from_openstack(pk)
                return Response({'detail': f'服务器{reboot_type.lower()}重启成功'})
            else:
                return Response(
                    {'error': '重启服务器失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"重启服务器失败: {str(e)}")
            return Response(
                {'error': f'重启服务器失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """暂停VM"""
        try:
            service = get_openstack_service()
            success = service.pause_server(pk)
            if success:
                self._sync_vm_status_from_openstack(pk)
                return Response({'detail': '服务器暂停成功'})
            else:
                return Response(
                    {'error': '暂停服务器失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"暂停服务器失败: {str(e)}")
            return Response(
                {'error': f'暂停服务器失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def unpause(self, request, pk=None):
        """恢复VM"""
        try:
            service = get_openstack_service()
            success = service.unpause_server(pk)
            if success:
                self._sync_vm_status_from_openstack(pk)
                return Response({'detail': '服务器恢复成功'})
            else:
                return Response(
                    {'error': '恢复服务器失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"恢复服务器失败: {str(e)}")
            return Response(
                {'error': f'恢复服务器失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def resize(self, request, pk=None):
        """调整VM配置"""
        try:
            service = get_openstack_service()
            flavor_id = request.data.get('flavor_id')
            
            # 部分前端可能传递 cpu_cores/memory_gb，这里简化处理，要求传递 flavor_id
            # 如果需要动态查找 flavor，可以在这里添加逻辑
            
            if not flavor_id:
                # 尝试根据 cpu/ram 查找 flavor (简化逻辑)
                cpu = request.data.get('cpu_cores')
                ram = request.data.get('memory_gb')
                if cpu and ram:
                    # 查找匹配的 flavor
                    flavors = service.list_flavors()
                    # 简单匹配：vcpus相等且ram相等
                    for f in flavors:
                        if f.get('vcpus') == int(cpu) and int(f.get('ram') / 1024) == int(ram):
                            flavor_id = f.get('id')
                            break
            
            if not flavor_id:
                return Response(
                    {'error': '缺少必要参数: flavor_id 或 匹配的cpu/ram'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 检查是否需要自动确认
            auto_confirm = request.data.get('auto_confirm', True)
            
            success = service.resize_server(pk, flavor_id, auto_confirm=auto_confirm)
            if success:
                msg = '服务器配置调整请求已发送'
                if not auto_confirm:
                    msg += '，请等待状态变为VERIFY_RESIZE后手动确认或回滚'
                return Response({'detail': msg})
            else:
                return Response(
                    {'error': '调整服务器配置失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"调整服务器配置失败: {str(e)}")
            return Response(
                {'error': f'调整服务器配置失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def confirm_resize(self, request, pk=None):
        """确认resize操作"""
        try:
            service = get_openstack_service()
            success = service.confirm_server_resize(pk)
            if success:
                return Response({'detail': '已确认resize操作'})
            else:
                return Response(
                    {'error': '确认resize失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"确认resize失败: {str(e)}")
            return Response(
                {'error': f'确认resize失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def revert_resize(self, request, pk=None):
        """回滚resize操作"""
        try:
            service = get_openstack_service()
            success = service.revert_server_resize(pk)
            if success:
                return Response({'detail': '已回滚resize操作'})
            else:
                return Response(
                    {'error': '回滚resize失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"回滚resize失败: {str(e)}")
            return Response(
                {'error': f'回滚resize失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _sync_vm_status_from_openstack(self, openstack_id):
        """从OpenStack同步单个VM的状态到数据库"""
        try:
            from apps.information_systems.models import VirtualMachine
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            
            service = get_openstack_service()
            
            # 从OpenStack获取VM最新状态
            server = service.get_server(openstack_id)
            if not server:
                return
            
            # 更新数据库中的VM状态
            vm = VirtualMachine.objects.filter(openstack_id=openstack_id).first()
            if vm:
                # OpenStack状态映射
                os_status = server.get('status', '').upper()
                vm_status_map = {
                    'ACTIVE': 'running',
                    'SHUTOFF': 'stopped',
                    'PAUSED': 'paused',
                    'SUSPENDED': 'suspended',
                    'BUILD': 'building',
                    'ERROR': 'error'
                }
                
                old_status = vm.status
                new_status = vm_status_map.get(os_status, os_status.lower())
                
                # 只有状态真正变化时才更新和推送
                if old_status != new_status:
                    vm.status = new_status
                    vm.save(update_fields=['status'])
                    logger.info(f"已同步VM {vm.name} 状态: {old_status} -> {new_status}")
                    
                    # 【WebSocket推送】通过WebSocket实时推送状态变化
                    try:
                        channel_layer = get_channel_layer()
                        if channel_layer:
                            async_to_sync(channel_layer.group_send)(
                                'vm_status_updates',
                                {
                                    'type': 'vm_status_update',
                                    'data': {
                                        'vm_id': vm.id,
                                        'openstack_id': openstack_id,
                                        'name': vm.name,
                                        'old_status': old_status,
                                        'new_status': new_status,
                                        'timestamp': vm.updated_at.isoformat() if vm.updated_at else None
                                    }
                                }
                            )
                            logger.info(f"已推送VM {vm.name} 状态变化到WebSocket")
                    except Exception as ws_error:
                        logger.warning(f"WebSocket推送失败: {str(ws_error)}")
                        
        except Exception as e:
            logger.warning(f"同步VM状态失败: {str(e)}")

    @action(detail=False, methods=['post'])
    def batch_action(self, request):
        """批量操作VM"""
        try:
            service = get_openstack_service()
            action_type = request.data.get('action')  # start, stop, reboot, delete
            vm_ids = request.data.get('vm_ids', [])
            
            if not action_type or not vm_ids:
                return Response(
                    {'error': '缺少必要参数: action和vm_ids'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            results = {
                'success': [],
                'failed': [],
                'total': len(vm_ids)
            }
            
            for vm_id in vm_ids:
                try:
                    if action_type == 'start':
                        success = service.start_server(vm_id)
                    elif action_type == 'stop':
                        success = service.stop_server(vm_id)
                    elif action_type == 'reboot':
                        reboot_type = request.data.get('reboot_type', 'SOFT')
                        success = service.reboot_server(vm_id, reboot_type)
                    elif action_type == 'delete':
                        success = service.delete_server(vm_id)
                    else:
                        results['failed'].append({'id': vm_id, 'error': '未知操作类型'})
                        continue
                    
                    if success:
                        results['success'].append(vm_id)
                    else:
                        results['failed'].append({'id': vm_id, 'error': '操作失败'})
                except Exception as e:
                    results['failed'].append({'id': vm_id, 'error': str(e)})
            
            return Response({
                'message': f'批量操作完成: 成功{len(results["success"])}个，失败{len(results["failed"])}个',
                'results': results
            })
        except Exception as e:
            logger.error(f"批量操作失败: {str(e)}")
            return Response(
                {'error': f'批量操作失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OpenStackImageViewSet(ViewSet):
    """OpenStack镜像管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出镜像
        
        查询参数:
            include_snapshots: 是否包含实例快照，默认 false
        """
        try:
            service = get_openstack_service()
            # 检查是否需要包含快照
            include_snapshots = request.query_params.get('include_snapshots', 'false').lower() == 'true'
            images = service.list_images(include_snapshots=include_snapshots)
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

    def create(self, request):
        """上传创建镜像"""
        try:
            service = get_openstack_service()
            data = request.data
            
            # 验证必要参数
            name = data.get('name')
            if not name:
                return Response(
                    {'error': '镜像名称不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 创建镜像元数据
            image = service.create_image(
                name=name,
                disk_format=data.get('disk_format', 'qcow2'),
                container_format=data.get('container_format', 'bare'),
                visibility=data.get('visibility', 'private'),
                min_disk=int(data.get('min_disk', 0)),
                min_ram=int(data.get('min_ram', 0)),
                properties=data.get('properties')
            )
            
            # 如果有文件上传，上传镜像数据
            if 'file' in request.FILES:
                image_file = request.FILES['file']
                try:
                    service.upload_image(image['id'], image_file)
                except Exception as upload_error:
                    # 上传失败，删除已创建的镜像
                    logger.error(f"上传镜像数据失败: {str(upload_error)}")
                    service.delete_image(image['id'])
                    return Response(
                        {'error': f'上传镜像数据失败: {str(upload_error)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            logger.info(f"创建镜像成功: {name} ({image['id']})")
            return Response(format_resource_data(image), status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"创建镜像失败: {str(e)}")
            return Response(
                {'error': f'创建镜像失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def partial_update(self, request, pk=None):
        """更新镜像元数据"""
        try:
            service = get_openstack_service()
            
            # 检查镜像是否存在
            existing_image = service.get_image(pk)
            if not existing_image:
                return Response(
                    {'error': '镜像不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 更新镜像
            update_data = {}
            if 'name' in request.data:
                update_data['name'] = request.data['name']
            if 'min_disk' in request.data:
                update_data['min_disk'] = int(request.data['min_disk'])
            if 'min_ram' in request.data:
                update_data['min_ram'] = int(request.data['min_ram'])
            if 'visibility' in request.data:
                update_data['visibility'] = request.data['visibility']
            
            if not update_data:
                return Response(
                    {'error': '没有提供要更新的字段'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            updated_image = service.update_image(pk, **update_data)
            logger.info(f"更新镜像成功: {pk}")
            return Response(format_resource_data(updated_image))
            
        except Exception as e:
            logger.error(f"更新镜像失败: {str(e)}")
            return Response(
                {'error': f'更新镜像失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, pk=None):
        """删除镜像"""
        try:
            service = get_openstack_service()
            
            # 检查镜像是否存在
            existing_image = service.get_image(pk)
            if not existing_image:
                return Response(
                    {'error': '镜像不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 删除镜像
            success = service.delete_image(pk)
            if success:
                logger.info(f"删除镜像成功: {pk}")
                return Response({'detail': '镜像删除成功'})
            else:
                return Response(
                    {'error': '删除镜像失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            logger.error(f"删除镜像失败: {str(e)}")
            return Response(
                {'error': f'删除镜像失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def prepare_upload(self, request):
        """准备镜像上传（直接上传到 OpenStack）
        
        前端先调用此接口创建镜像元数据，获取上传 URL 和 token，
        然后直接上传文件到 OpenStack Glance，绕过 Django 后端。
        
        返回:
            image_id: 镜像 ID
            upload_url: Glance 上传 URL
            token: OpenStack 认证 token
        """
        try:
            service = get_openstack_service()
            data = request.data
            
            # 验证必要参数
            name = data.get('name')
            if not name:
                return Response(
                    {'error': '镜像名称不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 创建镜像元数据（不包含文件）
            image = service.create_image(
                name=name,
                disk_format=data.get('disk_format', 'qcow2'),
                container_format=data.get('container_format', 'bare'),
                visibility=data.get('visibility', 'private'),
                min_disk=int(data.get('min_disk', 0)),
                min_ram=int(data.get('min_ram', 0)),
                properties=data.get('properties')
            )
            
            # 获取 OpenStack 连接信息
            conn = service.get_connection()
            auth_token = conn.session.get_token()
            
            # 使用 Nginx 代理路径，前端通过代理访问 Glance
            upload_url = f"/glance-proxy/v2/images/{image['id']}/file"
            
            logger.info(f"准备镜像上传: {name} ({image['id']})")
            
            return Response({
                'image_id': image['id'],
                'image_name': name,
                'upload_url': upload_url,
                'token': auth_token,
                'disk_format': data.get('disk_format', 'qcow2'),
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"准备镜像上传失败: {str(e)}")
            return Response(
                {'error': f'准备镜像上传失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
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


from rest_framework.decorators import action


class OpenStackVolumeViewSet(ViewSet):
    """OpenStack卷管理视图集 (Cinder)"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出卷"""
        try:
            service = get_openstack_service()
            project_id = request.query_params.get('project_id')
            all_tenants = request.query_params.get('all_tenants', 'false').lower() == 'true'
            volumes = service.list_volumes(project_id=project_id, all_tenants=all_tenants)
            formatted_volumes = [format_resource_data(vol) for vol in volumes]
            return Response(formatted_volumes)
        except Exception as e:
            logger.error(f"列出卷失败: {str(e)}")
            return Response(
                {'error': f'列出卷失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取卷详情"""
        try:
            service = get_openstack_service()
            volume = service.get_volume(pk)
            if volume:
                return Response(format_resource_data(volume))
            else:
                return Response(
                    {'error': '卷不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取卷详情失败: {str(e)}")
            return Response(
                {'error': f'获取卷详情失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建卷"""
        try:
            service = get_openstack_service()
            data = request.data
            
            name = data.get('name')
            size = data.get('size')
            
            if not name or not size:
                return Response(
                    {'error': '缺少必要参数: name, size'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            volume = service.create_volume(
                name=name,
                size=int(size),
                description=data.get('description', ''),
                volume_type=data.get('volume_type'),
                image_id=data.get('image_id'),  # 从镜像创建卷
                snapshot_id=data.get('snapshot_id'),  # 从快照创建卷
            )
            return Response(format_resource_data(volume), status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建卷失败: {str(e)}")
            return Response(
                {'error': f'创建卷失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, pk=None):
        """删除卷"""
        try:
            service = get_openstack_service()
            success = service.delete_volume(pk)
            
            if success:
                return Response({'detail': '卷删除成功'})
            else:
                return Response(
                    {'error': '卷删除失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"删除卷失败: {str(e)}")
            return Response(
                {'error': f'删除卷失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OpenStackVolumeSnapshotViewSet(ViewSet):
    """OpenStack卷快照管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出卷快照"""
        try:
            service = get_openstack_service()
            project_id = request.query_params.get('project_id')
            all_tenants = request.query_params.get('all_tenants', 'false').lower() == 'true'
            snapshots = service.list_volume_snapshots(project_id=project_id, all_tenants=all_tenants)
            formatted_snapshots = [format_resource_data(snap) for snap in snapshots]
            return Response(formatted_snapshots)
        except Exception as e:
            logger.error(f"列出卷快照失败: {str(e)}")
            return Response(
                {'error': f'列出卷快照失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取卷快照详情"""
        try:
            service = get_openstack_service()
            snapshot = service.get_volume_snapshot(pk)
            if snapshot:
                return Response(format_resource_data(snapshot))
            else:
                return Response(
                    {'error': '卷快照不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取卷快照详情失败: {str(e)}")
            return Response(
                {'error': f'获取卷快照详情失败: {str(e)}'},
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
            detailed = request.query_params.get('detailed', 'false').lower() == 'true'
            
            if detailed:
                # 返回详细网络信息（包括子网数据）
                networks = service.list_networks(project_id)
                detailed_networks = []
                for network in networks:
                    # 获取子网列表
                    subnets = service.list_subnets(network.get('id'))
                    network['subnets'] = subnets
                    network['subnet_count'] = len(subnets)
                    
                    # 确定网络类型
                    if network.get('router:external', False):
                        network['network_type'] = 'external'
                    elif network.get('shared', False):
                        network['network_type'] = 'shared'
                    else:
                        network['network_type'] = 'private'
                    
                    detailed_networks.append(format_resource_data(network))
                return Response(detailed_networks)
            else:
                networks = service.list_networks(project_id)
                formatted_networks = [format_resource_data(network) for network in networks]
                return Response(formatted_networks)
        except Exception as e:
            logger.error(f"列出网络失败: {str(e)}")
            return Response(
                {'error': f'列出网络失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取网络详情"""
        try:
            service = get_openstack_service()
            network = service.get_network_details(pk)
            if network:
                return Response(format_resource_data(network))
            else:
                return Response(
                    {'error': '网络不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取网络详情失败: {str(e)}")
            return Response(
                {'error': f'获取网络详情失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def subnets(self, request, pk=None):
        """获取网络的子网列表"""
        try:
            service = get_openstack_service()
            subnets = service.list_subnets(network_id=pk)
            formatted_subnets = [format_resource_data(subnet) for subnet in subnets]
            return Response(formatted_subnets)
        except Exception as e:
            logger.error(f"获取子网列表失败: {str(e)}")
            return Response(
                {'error': f'获取子网列表失败: {str(e)}'},
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


class FloatingIPViewSet(ViewSet):
    """浮动IP管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出浮动IP"""
        try:
            service = get_openstack_service()
            project_id = request.query_params.get('project_id')
            floating_ips = service.list_floating_ips(project_id)
            formatted_ips = [format_resource_data(fip) for fip in floating_ips]
            return Response(formatted_ips)
        except Exception as e:
            logger.error(f"列出浮动IP失败: {str(e)}")
            return Response(
                {'error': f'列出浮动IP失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """分配浮动IP"""
        try:
            service = get_openstack_service()
            data = request.data
            
            network_id = data.get('network_id')
            if not network_id:
                return Response(
                    {'error': '缺少network_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            floating_ip = service.allocate_floating_ip(
                network_id=network_id,
                project_id=data.get('project_id')
            )
            return Response(format_resource_data(floating_ip), status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"分配浮动IP失败: {str(e)}")
            return Response(
                {'error': f'分配浮动IP失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def associate(self, request, pk=None):
        """绑定浮动IP到服务器"""
        try:
            service = get_openstack_service()
            data = request.data
            
            server_id = data.get('server_id')
            if not server_id:
                return Response(
                    {'error': '缺少server_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 获取服务器的第一个端口
            ports = service.get_server_ports(server_id)
            if not ports:
                return Response(
                    {'error': '服务器没有可用的网络端口'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            port_id = ports[0]['id']
            success = service.associate_floating_ip(pk, port_id)
            
            if success:
                return Response({'detail': '浮动IP绑定成功'})
            else:
                return Response(
                    {'error': '浮动IP绑定失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"绑定浮动IP失败: {str(e)}")
            return Response(
                {'error': f'绑定浮动IP失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def disassociate(self, request, pk=None):
        """解绑浮动IP"""
        try:
            service = get_openstack_service()
            success = service.disassociate_floating_ip(pk)
            
            if success:
                return Response({'detail': '浮动IP解绑成功'})
            else:
                return Response(
                    {'error': '浮动IP解绑失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"解绑浮动IP失败: {str(e)}")
            return Response(
                {'error': f'解绑浮动IP失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, pk=None):
        """释放浮动IP"""
        try:
            service = get_openstack_service()
            success = service.release_floating_ip(pk)
            
            if success:
                return Response({'detail': '浮动IP释放成功'})
            else:
                return Response(
                    {'error': '浮动IP释放失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"释放浮动IP失败: {str(e)}")
            return Response(
                {'error': f'释放浮动IP失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SecurityGroupViewSet(ViewSet):
    """安全组管理视图集"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出安全组"""
        try:
            service = get_openstack_service()
            project_id = request.query_params.get('project_id')
            security_groups = service.list_security_groups(project_id)
            formatted_sgs = [format_resource_data(sg) for sg in security_groups]
            return Response(formatted_sgs)
        except Exception as e:
            logger.error(f"列出安全组失败: {str(e)}")
            return Response(
                {'error': f'列出安全组失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取安全组详情"""
        try:
            service = get_openstack_service()
            sg = service.get_security_group(pk)
            if sg:
                return Response(format_resource_data(sg))
            else:
                return Response(
                    {'error': '安全组不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            logger.error(f"获取安全组详情失败: {str(e)}")
            return Response(
                {'error': f'获取安全组详情失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建安全组"""
        try:
            service = get_openstack_service()
            data = request.data
            
            sg = service.create_security_group(
                name=data.get('name'),
                description=data.get('description', ''),
                project_id=data.get('project_id')
            )
            return Response(format_resource_data(sg), status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建安全组失败: {str(e)}")
            return Response(
                {'error': f'创建安全组失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def destroy(self, request, pk=None):
        """删除安全组"""
        try:
            service = get_openstack_service()
            success = service.delete_security_group(pk)
            
            if success:
                return Response({'detail': '安全组删除成功'})
            else:
                return Response(
                    {'error': '安全组删除失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"删除安全组失败: {str(e)}")
            return Response(
                {'error': f'删除安全组失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def add_rule(self, request, pk=None):
        """添加安全组规则"""
        try:
            service = get_openstack_service()
            data = request.data
            
            rule = service.create_security_group_rule(
                sg_id=pk,
                direction=data.get('direction', 'ingress'),
                protocol=data.get('protocol'),
                port_range_min=data.get('port_range_min'),
                port_range_max=data.get('port_range_max'),
                remote_ip_prefix=data.get('remote_ip_prefix'),
                ethertype=data.get('ethertype', 'IPv4')
            )
            return Response(format_resource_data(rule), status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"添加安全组规则失败: {str(e)}")
            return Response(
                {'error': f'添加安全组规则失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['delete'], url_path='rules/(?P<rule_id>[^/.]+)')
    def delete_rule(self, request, pk=None, rule_id=None):
        """删除安全组规则"""
        try:
            service = get_openstack_service()
            success = service.delete_security_group_rule(rule_id)
            
            if success:
                return Response({'detail': '安全组规则删除成功'})
            else:
                return Response(
                    {'error': '安全组规则删除失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"删除安全组规则失败: {str(e)}")
            return Response(
                {'error': f'删除安全组规则失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def network_traffic_stats(request):
    """获取网络流量统计（Phase 4）"""
    try:
        from apps.monitoring.models import VMMetricHistory
        from django.db.models import Avg, Sum, Max
        from datetime import datetime, timedelta
        
        # 获取参数
        vm_id = request.query_params.get('vm_id')
        hours = int(request.query_params.get('hours', 24))
        
        # 计算时间范围
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        # 查询指标
        queryset = VMMetricHistory.objects.filter(
            timestamp__gte=start_time,
            timestamp__lte=end_time
        )
        
        if vm_id:
            queryset = queryset.filter(virtual_machine_id=vm_id)
        
        # 聚合数据
        stats = queryset.values('virtual_machine_id', 'virtual_machine__name').annotate(
            avg_network_in=Avg('network_in_rate'),
            avg_network_out=Avg('network_out_rate'),
            total_network_in=Sum('network_in_rate'),
            total_network_out=Sum('network_out_rate')
        )
        
        # 格式化结果
        result = []
        for stat in stats:
            result.append({
                'vm_id': stat['virtual_machine_id'],
                'vm_name': stat['virtual_machine__name'],
                # network_in_rate and network_out_rate are in KB/s, convert to Mbps
                'avg_rx_mbps': round((stat['avg_network_in'] or 0) / 1024, 2),
                'avg_tx_mbps': round((stat['avg_network_out'] or 0) / 1024, 2),
                # For total, we approximate using average * duration
                'total_rx_gb': round((stat['avg_network_in'] or 0) * hours * 3600 / 1024 / 1024, 2),
                'total_tx_gb': round((stat['avg_network_out'] or 0) * hours * 3600 / 1024 / 1024, 2)
            })
        
        # 获取时间序列数据（用于图表）
        time_series = []
        if vm_id:
            # 获取最近的记录用于绘制趋势图
            recent_metrics = queryset.filter(virtual_machine_id=vm_id).order_by('-timestamp')[:50]
            for metric in reversed(list(recent_metrics)):
                time_series.append({
                    'time': metric.timestamp.strftime('%H:%M:%S'),
                    # network_in_rate and network_out_rate are in KB/s, convert to Mbps
                    'rx_mbps': round((metric.network_in_rate or 0) / 1024, 2),
                    'tx_mbps': round((metric.network_out_rate or 0) / 1024, 2)
                })
        
        return Response({
            'time_range': {
                'start': start_time.isoformat(),
                'end': end_time.isoformat(),
                'hours': hours
            },
            'stats': result,
            'time_series': time_series
        })
    except Exception as e:
        logger.error(f"获取网络流量统计失败: {str(e)}")
        return Response(
            {'error': f'获取网络流量统计失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def collect_vm_metrics(request):
    """手动触发虚拟机监控数据收集"""
    try:
        from apps.monitoring.models import VMMetricHistory
        from apps.information_systems.models import VirtualMachine
        from django.utils import timezone
        
        vm_id = request.data.get('vm_id')
        
        if vm_id:
            # 收集单个VM的数据
            try:
                vm = VirtualMachine.objects.get(id=vm_id)
            except VirtualMachine.DoesNotExist:
                return Response({'error': 'VM不存在'}, status=status.HTTP_404_NOT_FOUND)
            
            vms_to_collect = [vm]
        else:
            # 收集所有运行中的VM
            vms_to_collect = VirtualMachine.objects.filter(status='running')
        
        service = get_openstack_service()
        collected_count = 0
        errors = []
        details = []
        
        for vm in vms_to_collect:
            if not vm.openstack_id:
                error_msg = f"VM {vm.name} 没有OpenStack ID"
                errors.append(error_msg)
                details.append({'vm': vm.name, 'status': 'skipped', 'reason': '没有OpenStack ID'})
                logger.warning(error_msg)
                continue
            
            try:
                logger.info(f"正在采集 VM {vm.name} (OpenStack ID: {vm.openstack_id}) 的监控数据...")
                metrics = service.get_server_metrics(vm.openstack_id)
                
                if not metrics:
                    error_msg = f"VM {vm.name} 未返回监控数据"
                    errors.append(error_msg)
                    details.append({'vm': vm.name, 'status': 'failed', 'reason': '未返回监控数据'})
                    logger.warning(error_msg)
                    continue
                
                logger.info(f"收到 VM {vm.name} 的监控数据: {metrics}")
                
                # 保存监控数据
                metric_record = VMMetricHistory.objects.create(
                    virtual_machine=vm,
                    cpu_usage=metrics.get('cpu_usage_percent', 0),
                    memory_usage=metrics.get('memory_usage_percent', 0),
                    network_in_rate=metrics.get('network_in_bytes', 0) / 1024,  # 转KB/s
                    network_out_rate=metrics.get('network_out_bytes', 0) / 1024,  # 转KB/s
                    timestamp=timezone.now()
                )
                collected_count += 1
                details.append({
                    'vm': vm.name,
                    'status': 'success',
                    'cpu': metrics.get('cpu_usage_percent', 0),
                    'memory': metrics.get('memory_usage_percent', 0),
                    'network_in_kb': round(metrics.get('network_in_bytes', 0) / 1024, 2),
                    'network_out_kb': round(metrics.get('network_out_bytes', 0) / 1024, 2),
                    'record_id': str(metric_record.id)
                })
                logger.info(f"成功保存 VM {vm.name} 的监控数据，记录ID: {metric_record.id}")
                
            except Exception as e:
                error_msg = f"VM {vm.name}: {str(e)}"
                errors.append(error_msg)
                details.append({'vm': vm.name, 'status': 'error', 'error': str(e)})
                logger.error(f"采集虚拟机 {vm.name} 的监控数据失败: {str(e)}", exc_info=True)
        
        return Response({
            'message': f'成功采集 {collected_count} 个虚拟机的监控数据',
            'collected_count': collected_count,
            'total_vms': len(vms_to_collect),
            'errors': errors if errors else None,
            'details': details
        })
    except Exception as e:
        logger.error(f"采集监控数据失败: {str(e)}", exc_info=True)
        return Response(
            {'error': f'采集监控数据失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cloud_overview(request):
    """获取云资源总览统计"""
    try:
        service = get_openstack_service()

        # 获取各类资源统计
        servers = service.list_servers()
        images = service.list_images()
        flavors = service.list_flavors()
        networks = service.list_networks()

        # 计算资源使用情况
        total_vcpus = 0
        used_vcpus = 0
        total_ram = 0
        used_ram = 0
        total_disk = 0
        used_disk = 0

        running_instances = 0
        stopped_instances = 0

        for server in servers:
            server_status = server.get('status', '').upper() if isinstance(server, dict) else getattr(server, 'status', '').upper()
            if server_status == 'ACTIVE':
                running_instances += 1
            elif server_status in ['SHUTOFF', 'STOPPED']:
                stopped_instances += 1

            # 获取flavor信息计算资源
            server_flavor = server.get('flavor') if isinstance(server, dict) else getattr(server, 'flavor', None)
            if server_flavor and isinstance(server_flavor, dict) and 'id' in server_flavor:
                try:
                    flavor = service.get_flavor(server_flavor['id'])
                    if flavor:
                        used_vcpus += flavor.get('vcpus', 0) if isinstance(flavor, dict) else getattr(flavor, 'vcpus', 0)
                        used_ram += flavor.get('ram', 0) if isinstance(flavor, dict) else getattr(flavor, 'ram', 0)
                        used_disk += flavor.get('disk', 0) if isinstance(flavor, dict) else getattr(flavor, 'disk', 0)
                except:
                    pass

        # 计算总资源（基于所有flavor）
        for flavor in flavors:
            total_vcpus += getattr(flavor, 'vcpus', 0)
            total_ram += getattr(flavor, 'ram', 0)
            total_disk += getattr(flavor, 'disk', 0)

        overview = {
            'compute': {
                'total_instances': len(servers),
                'running_instances': running_instances,
                'stopped_instances': stopped_instances,
                'vcpus': {
                    'total': total_vcpus,
                    'used': used_vcpus,
                    'available': total_vcpus - used_vcpus
                },
                'ram': {
                    'total': total_ram,
                    'used': used_ram,
                    'available': total_ram - used_ram
                },
                'disk': {
                    'total': total_disk,
                    'used': used_disk,
                    'available': total_disk - used_disk
                }
            },
            'images': {
                'total': len(images),
                'active': len([img for img in images if getattr(img, 'status', '') == 'active'])
            },
            'networks': {
                'total': len(networks)
            },
            'flavors': {
                'total': len(flavors)
            }
        }

        return Response(overview)
    except Exception as e:
        logger.error(f"获取云资源总览失败: {str(e)}")
        return Response(
            {'error': f'获取云资源总览失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resource_usage_report(request):
    """获取资源使用报表"""
    try:
        service = get_openstack_service()

        servers = service.list_servers()
        projects = service.list_projects()

        # 按项目统计资源使用
        project_usage = {}
        for project in projects:
            project_id = getattr(project, 'id', None)
            project_name = getattr(project, 'name', 'Unknown')

            project_servers = [s for s in servers if getattr(s, 'project_id', None) == project_id]

            vcpus = 0
            ram = 0
            disk = 0

            for server in project_servers:
                if hasattr(server, 'flavor') and 'id' in server.flavor:
                    try:
                        flavor = service.get_flavor(server.flavor['id'])
                        if flavor:
                            vcpus += getattr(flavor, 'vcpus', 0)
                            ram += getattr(flavor, 'ram', 0)
                            disk += getattr(flavor, 'disk', 0)
                    except:
                        pass

            project_usage[project_name] = {
                'instances': len(project_servers),
                'vcpus': vcpus,
                'ram': ram,
                'disk': disk
            }

        return Response({
            'project_usage': project_usage,
            'total_projects': len(projects),
            'total_instances': len(servers)
        })
    except Exception as e:
        logger.error(f"获取资源使用报表失败: {str(e)}")
        return Response(
            {'error': f'获取资源使用报表失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )