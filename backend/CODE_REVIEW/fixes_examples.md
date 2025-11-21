# 租户门户和虚拟机管理 - 修复代码示例

## 一、control_resource() API 修复示例

### 问题：
- 缺少并发控制
- 缺少事务处理
- 缺少幂等性检查

### 修复代码：

```python
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def control_resource(request):
    """控制资源的启停 - 通过 OpenStack API"""
    try:
        tenant = get_user_tenant(request.user)
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        resource_id = request.data.get('resource_id')
        resource_type = request.data.get('resource_type')
        action = request.data.get('action')

        if not all([resource_id, resource_type, action]):
            return Response({'error': '缺少必要参数'}, status=status.HTTP_400_BAD_REQUEST)

        if resource_type == 'vm':
            try:
                # 使用select_for_update进行行级锁，防止并发修改
                vm = VirtualMachine.objects.select_for_update().get(id=resource_id)

                if vm.information_system.tenant != tenant:
                    return Response({'error': '无权操作此资源'}, status=status.HTTP_403_FORBIDDEN)

                if not vm.openstack_id:
                    return Response({
                        'error': '虚拟机未绑定 OpenStack 实例，无法执行操作'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # 检查幂等性 - 避免不必要的操作
                if action == 'start':
                    if vm.status == VirtualMachine.VMStatus.RUNNING:
                        return Response({
                            'success': True,
                            'message': '虚拟机已处于运行状态',
                            'resource_id': resource_id,
                            'status': vm.status,
                            'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
                        })
                elif action == 'stop':
                    if vm.status == VirtualMachine.VMStatus.STOPPED:
                        return Response({
                            'success': True,
                            'message': '虚拟机已处于停止状态',
                            'resource_id': resource_id,
                            'status': vm.status,
                            'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
                        })

                openstack_service = get_openstack_service()
                operation_success = False
                operation_detail = ''

                # 在事务中执行OpenStack操作和数据库更新
                try:
                    with transaction.atomic():
                        if action == 'start':
                            operation_success = openstack_service.start_server(vm.openstack_id)
                            if operation_success:
                                vm.status = VirtualMachine.VMStatus.RUNNING
                                vm.last_start_time = timezone.now()
                                operation_detail = f'虚拟机 {vm.name} 已启动'
                            else:
                                operation_detail = f'启动虚拟机 {vm.name} 失败'

                        elif action == 'stop':
                            operation_success = openstack_service.stop_server(vm.openstack_id)
                            if operation_success:
                                vm.status = VirtualMachine.VMStatus.STOPPED
                                vm.last_stop_time = timezone.now()
                                operation_detail = f'虚拟机 {vm.name} 已停止'
                            else:
                                operation_detail = f'停止虚拟机 {vm.name} 失败'

                        elif action == 'restart':
                            operation_success = openstack_service.reboot_server(vm.openstack_id, 'SOFT')
                            if operation_success:
                                vm.status = VirtualMachine.VMStatus.RUNNING
                                vm.last_start_time = timezone.now()
                                operation_detail = f'虚拟机 {vm.name} 已重启'
                            else:
                                operation_detail = f'重启虚拟机 {vm.name} 失败'

                        else:
                            return Response({
                                'error': f'不支持的操作: {action}'
                            }, status=status.HTTP_400_BAD_REQUEST)

                        # 保存虚拟机状态和操作日志
                        if operation_success:
                            vm.save()

                        VMOperationLog.objects.create(
                            virtual_machine=vm,
                            operation_type=action,
                            operator=request.user,
                            operation_detail=operation_detail,
                            success=operation_success
                        )

                    if operation_success:
                        logger.info(f"虚拟机操作成功: {operation_detail}")
                        return Response({
                            'success': True,
                            'message': operation_detail,
                            'resource_id': str(resource_id),
                            'resource_type': resource_type,
                            'action': action,
                            'status': vm.status,
                            'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
                        })
                    else:
                        logger.error(f"虚拟机操作失败: {operation_detail}")
                        return Response({
                            'error': operation_detail
                        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                except Exception as openstack_error:
                    error_msg = f'OpenStack 操作失败: {str(openstack_error)}'
                    logger.error(error_msg, exc_info=True)

                    VMOperationLog.objects.create(
                        virtual_machine=vm,
                        operation_type=action,
                        operator=request.user,
                        operation_detail=error_msg,
                        success=False
                    )

                    return Response({
                        'error': error_msg
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            except VirtualMachine.DoesNotExist:
                return Response({'error': '虚拟机不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 其他资源类型
        return Response({
            'success': True,
            'message': f'资源{action}操作成功',
            'resource_id': str(resource_id),
            'resource_type': resource_type,
            'action': action,
            'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        })

    except Exception as e:
        logger.error(f"控制资源失败: {str(e)}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

---

## 二、create_virtual_machine() API 修复示例

### 问题：
- 缺少参数验证
- 缺少事务处理
- OpenStack失败时数据库状态混乱

### 修复代码：

```python
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone

def _validate_vm_config(data):
    """验证虚拟机配置参数"""
    errors = {}
    
    # 验证虚拟机名称
    vm_name = data.get('name', '').strip()
    if not vm_name:
        errors['name'] = '虚拟机名称不能为空'
    elif len(vm_name) > 200:
        errors['name'] = '虚拟机名称长度不能超过200字符'
    
    # 验证CPU核数
    try:
        cpu_cores = int(data.get('cpu_cores', 2))
        if cpu_cores < 1:
            errors['cpu_cores'] = 'CPU核数必须大于等于1'
        elif cpu_cores > 64:
            errors['cpu_cores'] = 'CPU核数不能超过64'
    except (TypeError, ValueError):
        errors['cpu_cores'] = 'CPU核数必须是整数'
    
    # 验证内存大小
    try:
        memory_gb = float(data.get('memory_gb', 4))
        if memory_gb < 1:
            errors['memory_gb'] = '内存大小必须大于等于1GB'
        elif memory_gb > 512:
            errors['memory_gb'] = '内存大小不能超过512GB'
    except (TypeError, ValueError):
        errors['memory_gb'] = '内存大小必须是数字'
    
    # 验证磁盘容量
    try:
        disk_gb = float(data.get('disk_gb', 100))
        if disk_gb < 10:
            errors['disk_gb'] = '磁盘容量必须大于等于10GB'
        elif disk_gb > 10000:
            errors['disk_gb'] = '磁盘容量不能超过10000GB'
    except (TypeError, ValueError):
        errors['disk_gb'] = '磁盘容量必须是数字'
    
    if errors:
        raise ValidationError(errors)
    
    return {
        'name': vm_name,
        'cpu_cores': int(cpu_cores),
        'memory_gb': float(memory_gb),
        'disk_gb': float(disk_gb)
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_virtual_machine(request):
    """创建虚拟机 - 通过 OpenStack API"""
    vm = None
    try:
        tenant = get_user_tenant(request.user)
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        
        # 验证参数
        try:
            vm_config = _validate_vm_config(data)
        except ValidationError as e:
            return Response(
                {'error': '参数验证失败', 'details': e.message_dict},
                status=status.HTTP_400_BAD_REQUEST
            )

        system_id = data.get('system_id')
        if not system_id:
            return Response({'error': '缺少信息系统ID'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取信息系统并验证权限
        try:
            system = InformationSystem.objects.get(id=system_id)
            if system.tenant != tenant:
                return Response({'error': '无权在此系统中创建虚拟机'}, status=status.HTTP_403_FORBIDDEN)
        except InformationSystem.DoesNotExist:
            return Response({'error': '信息系统不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 查找合适的 flavor, image, network
        logger.info(f"查找合适的资源配置")
        flavor = find_suitable_flavor(
            vm_config['cpu_cores'],
            vm_config['memory_gb'],
            vm_config['disk_gb']
        )
        if not flavor:
            return Response({
                'error': f"未找到合适的虚拟机规格"
            }, status=status.HTTP_400_BAD_REQUEST)

        os_type = data.get('os_type', 'Linux')
        os_version = data.get('os_version', '')
        image = find_suitable_image(os_type, os_version)
        if not image:
            return Response({
                'error': f'未找到合适的操作系统镜像'
            }, status=status.HTTP_400_BAD_REQUEST)

        network = get_default_network(tenant)
        if not network:
            return Response({
                'error': '未找到可用网络，请联系管理员配置网络'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 使用事务处理确保数据一致性
        try:
            with transaction.atomic():
                # 1. 先在数据库中创建虚拟机记录
                vm = VirtualMachine.objects.create(
                    information_system=system,
                    name=vm_config['name'],
                    cpu_cores=vm_config['cpu_cores'],
                    memory_gb=vm_config['memory_gb'],
                    disk_gb=vm_config['disk_gb'],
                    data_center_type=data.get('data_center_type', 'production'),
                    availability_zone=data.get('availability_zone', '') or None,
                    region=data.get('region', '') or None,
                    runtime_start=data.get('runtime_start'),
                    runtime_end=data.get('runtime_end'),
                    os_type=os_type,
                    os_version=os_version,
                    description=data.get('description', ''),
                    status=VirtualMachine.VMStatus.STOPPED,
                    created_by=request.user
                )

                logger.info(f"数据库虚拟机记录已创建: {vm.id}")

                # 2. 在 OpenStack 中创建虚拟机实例
                logger.info(f"在 OpenStack 中创建虚拟机: {vm_config['name']}")
                openstack_service = get_openstack_service()
                
                server = openstack_service.create_server(
                    name=vm_config['name'],
                    image_id=image.get('id'),
                    flavor_id=flavor.get('id'),
                    network_ids=[network.get('id')],
                    availability_zone=data.get('availability_zone') or None
                )

                # 3. 更新虚拟机的 OpenStack ID 和网络信息
                vm.openstack_id = server.get('id')

                # 获取分配的 IP 地址
                addresses = server.get('addresses', {})
                if addresses:
                    for network_name, addr_list in addresses.items():
                        if addr_list and len(addr_list) > 0:
                            ip_addr = addr_list[0].get('addr')
                            # 验证IP地址格式
                            if ip_addr:
                                vm.ip_address = ip_addr
                            if 'OS-EXT-IPS-MAC:mac_addr' in addr_list[0]:
                                vm.mac_address = addr_list[0].get('OS-EXT-IPS-MAC:mac_addr')
                            break

                # 根据 OpenStack 返回的状态更新虚拟机状态
                openstack_status = server.get('status', '').upper()
                if openstack_status == 'ACTIVE':
                    vm.status = VirtualMachine.VMStatus.RUNNING
                    vm.last_start_time = timezone.now()
                elif openstack_status == 'SHUTOFF':
                    vm.status = VirtualMachine.VMStatus.STOPPED
                elif openstack_status == 'ERROR':
                    vm.status = VirtualMachine.VMStatus.ERROR

                vm.save()

                # 4. 记录操作日志
                VMOperationLog.objects.create(
                    virtual_machine=vm,
                    operation_type='create',
                    operator=request.user,
                    operation_detail=f'在 OpenStack 中创建虚拟机 {vm.name}，实例ID: {vm.openstack_id}',
                    success=True
                )

                logger.info(f"虚拟机创建成功: {vm.name} (OpenStack ID: {vm.openstack_id})")

        except Exception as openstack_error:
            # OpenStack 创建失败，在事务回滚时自动删除数据库记录
            logger.error(f"OpenStack 创建虚拟机失败: {str(openstack_error)}", exc_info=True)
            
            # 记录失败日志（虽然会回滚，但先记录）
            if vm:
                VMOperationLog.objects.create(
                    virtual_machine=vm,
                    operation_type='create',
                    operator=request.user,
                    operation_detail=f'在 OpenStack 中创建虚拟机失败: {str(openstack_error)}',
                    success=False
                )
            
            # 异常会导致事务回滚，vm被删除
            raise

        return Response({
            'success': True,
            'message': '虚拟机创建成功',
            'vm': {
                'id': str(vm.id),
                'name': vm.name,
                'cpu_cores': vm.cpu_cores,
                'memory_gb': vm.memory_gb,
                'disk_gb': vm.disk_gb,
                'ip_address': vm.ip_address or '分配中',
                'mac_address': vm.mac_address or '分配中',
                'status': vm.status,
                'status_display': vm.get_status_display(),
                'openstack_id': vm.openstack_id
            }
        }, status=status.HTTP_201_CREATED)

    except ValidationError as e:
        logger.error(f"参数验证失败: {str(e)}")
        return Response(
            {'error': '参数验证失败', 'details': e.message_dict},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"创建虚拟机失败: {str(e)}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
```

---

## 三、sync_vm_status() 任务修复示例

### 问题：
- 状态映射不完整
- 缺少重试机制
- 缺少幂等性处理

### 修复代码：

```python
from celery import shared_task
from django.utils import timezone
from datetime import date, timedelta
import logging
import time

logger = logging.getLogger(__name__)

# OpenStack状态到系统状态的映射
OPENSTACK_STATUS_MAPPING = {
    'ACTIVE': 'running',
    'SHUTOFF': 'stopped',
    'PAUSED': 'paused',
    'SUSPENDED': 'paused',
    'ERROR': 'error',
    'BUILDING': 'running',  # 视为运行中
    'DELETING': 'stopped',
    'REBOOT': 'running',
    'HARD_REBOOT': 'running',
}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_vm_status(self):
    """
    同步虚拟机状态任务：从 OpenStack 同步真实状态
    建议每5分钟执行一次
    """
    logger.info("开始同步虚拟机状态...")

    synced_count = 0
    updated_count = 0
    error_count = 0
    skipped_count = 0

    # 获取所有有 OpenStack ID 的虚拟机
    vms = VirtualMachine.objects.exclude(
        openstack_id__isnull=True
    ).exclude(openstack_id='').select_related('information_system')

    try:
        openstack_service = get_openstack_service()
    except Exception as e:
        logger.error(f"获取 OpenStack 服务失败: {str(e)}", exc_info=True)
        # 重试任务
        try:
            raise self.retry(exc=e, countdown=60)
        except self.retry as exc:
            logger.error(f"同步任务已重试，等待重新执行: {str(exc)}")
            return {
                'synced_count': 0,
                'updated_count': 0,
                'error_count': 0,
                'skipped_count': 0,
                'error': str(e)
            }

    for vm in vms:
        try:
            # 获取虚拟机信息
            server_info = openstack_service.get_server(vm.openstack_id)

            if not server_info:
                # 虚拟机在 OpenStack 中不存在
                if vm.status != VirtualMachine.VMStatus.ERROR:
                    vm.status = VirtualMachine.VMStatus.ERROR
                    vm.save(update_fields=['status', 'updated_at'])

                    VMOperationLog.objects.create(
                        virtual_machine=vm,
                        operation_type='sync',
                        operator=None,
                        operation_detail='同步状态失败：在 OpenStack 中未找到虚拟机',
                        success=False
                    )
                    updated_count += 1
                else:
                    skipped_count += 1

                synced_count += 1
                continue

            # 获取OpenStack状态
            old_status = vm.status
            openstack_status = server_info.get('status', '').upper()
            new_status = OPENSTACK_STATUS_MAPPING.get(
                openstack_status,
                old_status  # 如果状态未知，保持原状
            )

            # 更新IP地址和MAC地址
            addresses = server_info.get('addresses', {})
            ip_changed = False
            mac_changed = False

            if addresses:
                for network_name, addr_list in addresses.items():
                    if addr_list and len(addr_list) > 0:
                        # 获取IP地址
                        new_ip = addr_list[0].get('addr')
                        if new_ip and vm.ip_address != new_ip:
                            try:
                                # 验证IP地址格式
                                from django.core.validators import ipv4_re
                                if ipv4_re.match(new_ip) or ':' in new_ip:  # IPv4 或 IPv6
                                    vm.ip_address = new_ip
                                    ip_changed = True
                            except:
                                logger.warning(f"虚拟机 {vm.name} 的IP地址格式无效: {new_ip}")

                        # 获取MAC地址
                        if 'OS-EXT-IPS-MAC:mac_addr' in addr_list[0]:
                            new_mac = addr_list[0]['OS-EXT-IPS-MAC:mac_addr']
                            if new_mac and vm.mac_address != new_mac:
                                vm.mac_address = new_mac
                                mac_changed = True

                        break

            # 检查状态是否变化
            if new_status != old_status:
                # 状态有变化
                vm.status = new_status

                # 更新启停时间
                if new_status == VirtualMachine.VMStatus.RUNNING:
                    vm.last_start_time = timezone.now()
                elif new_status == VirtualMachine.VMStatus.STOPPED:
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

            elif ip_changed or mac_changed:
                # 即使状态未变，IP或MAC有变化也保存
                update_fields = ['updated_at']
                if ip_changed:
                    update_fields.append('ip_address')
                if mac_changed:
                    update_fields.append('mac_address')

                vm.save(update_fields=update_fields)
                updated_count += 1
                logger.info(f"虚拟机 {vm.name} 网络信息已更新")

            else:
                # 状态未变，跳过
                skipped_count += 1

            synced_count += 1

        except Exception as e:
            error_count += 1
            logger.error(f"同步虚拟机 {vm.name} ({vm.openstack_id}) 失败: {str(e)}", exc_info=True)

            try:
                VMOperationLog.objects.create(
                    virtual_machine=vm,
                    operation_type='sync',
                    operator=None,
                    operation_detail=f'同步状态失败: {str(e)}',
                    success=False
                )
            except Exception as log_error:
                logger.error(f"记录操作日志失败: {str(log_error)}")

    logger.info(
        f"虚拟机状态同步完成！"
        f"总计: {synced_count}, 更新: {updated_count}, "
        f"跳过: {skipped_count}, 错误: {error_count}"
    )

    return {
        'synced_count': synced_count,
        'updated_count': updated_count,
        'skipped_count': skipped_count,
        'error_count': error_count
    }
```

---

## 四、OpenStack Services 修复示例

### create_server() 方法修复

```python
def create_server(self, name: str, image_id: str, flavor_id: str,
                  network_ids: List[str], timeout: int = 300, **kwargs) -> Dict[str, Any]:
    """
    创建服务器实例
    
    Args:
        name: 服务器名称（不能为空）
        image_id: 镜像ID（不能为空）
        flavor_id: 规格ID（不能为空）
        network_ids: 网络ID列表（不能为空）
        timeout: 等待超时时间（秒）
        **kwargs: 其他OpenStack参数
    
    Returns:
        服务器信息字典
    
    Raises:
        ValueError: 参数验证失败
        SDKException: OpenStack操作失败
    """
    # 参数验证
    if not name or not isinstance(name, str) or not name.strip():
        raise ValueError("服务器名称必须是非空字符串")
    
    if not image_id or not isinstance(image_id, str) or not image_id.strip():
        raise ValueError("镜像ID必须是非空字符串")
    
    if not flavor_id or not isinstance(flavor_id, str) or not flavor_id.strip():
        raise ValueError("规格ID必须是非空字符串")
    
    if not network_ids or not isinstance(network_ids, list) or len(network_ids) == 0:
        raise ValueError("网络ID列表必须是非空列表")
    
    # 验证网络ID格式
    for net_id in network_ids:
        if not isinstance(net_id, str) or not net_id.strip():
            raise ValueError(f"无效的网络ID: {net_id}")
    
    try:
        conn = self.get_connection()
        if not conn:
            raise SDKException("OpenStack连接失败")

        # 构建网络配置
        networks = [{'uuid': net_id.strip()} for net_id in network_ids]

        logger.info(f"创建服务器: name={name}, image={image_id}, flavor={flavor_id}")

        # 创建服务器
        server = conn.compute.create_server(
            name=name.strip(),
            image_id=image_id.strip(),
            flavor_id=flavor_id.strip(),
            networks=networks,
            **kwargs
        )

        if not server:
            raise SDKException("创建服务器失败：OpenStack返回空结果")

        # 等待服务器创建完成，设置超时
        start_time = time.time()
        try:
            conn.compute.wait_for_server(server, timeout=timeout)
            logger.info(f"服务器创建完成: {server.name} ({server.id})")
        except Exception as wait_error:
            elapsed_time = time.time() - start_time
            logger.warning(
                f"等待服务器创建超时或异常 (耗时 {elapsed_time:.1f}s): {str(wait_error)}"
            )
            # 虽然等待失败，但服务器可能已创建，检查一下状态
            try:
                server = conn.compute.get_server(server.id)
                if server:
                    logger.info(f"服务器已创建，当前状态: {server.status}")
                else:
                    raise SDKException(f"创建服务器失败：无法获取服务器信息")
            except:
                raise SDKException(f"创建服务器失败：{str(wait_error)}")

        server_dict = server.to_dict()
        logger.info(f"创建服务器成功: {server.name} ({server.id})")
        return server_dict

    except ValueError as e:
        logger.error(f"参数验证错误: {str(e)}")
        raise SDKException(f"参数错误: {str(e)}")
    except SDKException:
        raise
    except Exception as e:
        logger.error(f"创建服务器失败: {str(e)}", exc_info=True)
        raise SDKException(f"创建服务器失败: {str(e)}")


def start_server(self, server_id: str, timeout: int = 60) -> bool:
    """
    启动服务器（带状态检查）
    
    Args:
        server_id: 服务器ID
        timeout: 等待启动完成的超时时间（秒）
    
    Returns:
        True表示启动成功，False表示失败
    """
    if not server_id or not isinstance(server_id, str):
        logger.error("服务器ID不能为空")
        return False

    try:
        conn = self.get_connection()
        if not conn:
            logger.error("OpenStack连接失败")
            return False

        # 检查当前状态
        server = conn.compute.get_server(server_id)
        if not server:
            logger.error(f"服务器不存在: {server_id}")
            return False

        current_status = server.status.upper()
        
        # 如果已经运行，直接返回成功
        if current_status == 'ACTIVE':
            logger.info(f"服务器已处于运行状态: {server_id}")
            return True

        # 如果处于错误状态，无法启动
        if current_status == 'ERROR':
            logger.error(f"服务器处于错误状态，无法启动: {server_id}")
            return False

        # 启动服务器
        logger.info(f"启动服务器: {server_id}")
        conn.compute.start_server(server_id)

        # 等待服务器启动
        start_time = time.time()
        while time.time() - start_time < timeout:
            server = conn.compute.get_server(server_id)
            if not server:
                logger.error(f"服务器已删除: {server_id}")
                return False

            if server.status.upper() == 'ACTIVE':
                logger.info(f"服务器启动成功: {server_id}")
                return True

            time.sleep(5)

        logger.warning(f"服务器启动超时: {server_id}")
        return False

    except Exception as e:
        logger.error(f"启动服务器失败: {str(e)}")
        return False
```

