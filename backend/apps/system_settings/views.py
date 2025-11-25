from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.conf import settings
from .models import SystemSetting
import logging

logger = logging.getLogger(__name__)


class SystemSettingsViewSet(viewsets.ViewSet):
    """系统设置ViewSet"""
    
    def get_permissions(self):
        """
        读取操作允许所有认证用户
        写入操作只允许管理员
        """
        if self.action in ['list', 'category', 'openstack_config']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def list(self, request):
        """获取所有设置"""
        categories = ['system', 'database', 'openstack', 'notification']
        result = {}
        
        for category in categories:
            result[category] = SystemSetting.get_settings(category)
        
        return Response(result)

    def create(self, request):
        """创建或更新设置"""
        category = request.data.get('category')
        settings_data = request.data.get('settings')
        
        if not category or not settings_data:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 特殊处理数据库设置
            if category == 'database':
                return self._save_database_config(settings_data)
            
            # 特殊处理 OpenStack 设置
            if category == 'openstack':
                return self._save_openstack_config(settings_data)
                
            SystemSetting.update_settings(category, settings_data)
            return Response({
                'message': '设置保存成功',
                'category': category,
                'settings': settings_data
            })
        except Exception as e:
            logger.error(f"保存设置失败: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _save_database_config(self, db_config):
        """保存数据库配置到 .env 文件"""
        try:
            # 1. 保存到 SystemSetting 模型
            SystemSetting.update_settings('database', db_config)
            
            # 2. 更新 .env 文件
            from pathlib import Path
            env_path = Path(settings.BASE_DIR) / '.env'
            
            if env_path.exists():
                with open(env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                new_lines = []
                db_keys = {
                    'ENGINE': 'DB_ENGINE',
                    'NAME': 'DB_NAME',
                    'USER': 'DB_USER',
                    'PASSWORD': 'DB_PASSWORD',
                    'HOST': 'DB_HOST',
                    'PORT': 'DB_PORT'
                }
                
                # 移除旧的 DB 配置行
                for line in lines:
                    is_db_config = False
                    for key in db_keys.values():
                        if line.strip().startswith(f"{key}="):
                            is_db_config = True
                            break
                    if not is_db_config:
                        new_lines.append(line)
                
                # 添加新的 DB 配置
                if new_lines and not new_lines[-1].endswith('\n'):
                    new_lines.append('\n')
                
                new_lines.append(f"\n# Database Configuration (Updated via UI)\n")
                for key, env_key in db_keys.items():
                    value = db_config.get(key, '')
                    if value:
                        new_lines.append(f"{env_key}={value}\n")
                
                with open(env_path, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)
            
            return Response({
                'message': '数据库设置已保存。请重启服务器以应用更改。',
                'category': 'database',
                'settings': db_config
            })
        except Exception as e:
            raise e

    def _save_openstack_config(self, os_config):
        """保存 OpenStack 配置到 .env 文件"""
        try:
            # 1. 保存到 SystemSetting 模型
            SystemSetting.update_settings('openstack', os_config)
            
            # 2. 更新 .env 文件
            from pathlib import Path
            env_path = Path(settings.BASE_DIR) / '.env'
            
            if env_path.exists():
                with open(env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                new_lines = []
                os_keys = {
                    'authUrl': 'OPENSTACK_AUTH_URL',
                    'username': 'OPENSTACK_USERNAME',
                    'password': 'OPENSTACK_PASSWORD',
                    'projectName': 'OPENSTACK_PROJECT_NAME',
                    'userDomain': 'OPENSTACK_USER_DOMAIN_NAME',
                    'projectDomain': 'OPENSTACK_PROJECT_DOMAIN_NAME',
                    'regionName': 'OPENSTACK_REGION_NAME',
                    'syncInterval': 'OPENSTACK_SYNC_INTERVAL' # Add syncInterval to keys
                }
                
                # 移除旧的 OpenStack 配置行
                for line in lines:
                    is_os_config = False
                    for key in os_keys.values():
                        if line.strip().startswith(f"{key}="):
                            is_os_config = True
                            break
                    if not is_os_config:
                        new_lines.append(line)
                
                # 添加新的 OpenStack 配置
                if new_lines and not new_lines[-1].endswith('\n'):
                    new_lines.append('\n')
                
                new_lines.append(f"\n# OpenStack Configuration (Updated via UI)\n")
                for key, env_key in os_keys.items():
                    value = os_config.get(key, '')
                    # 如果密码为空，不更新（保留原密码或空）
                    if key == 'password' and not value:
                        continue
                    if value:
                        new_lines.append(f"{env_key}={value}\n")
                
                with open(env_path, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)

            # 3. 处理同步频率 (更新 Celery 配置需要重启，这里我们更新 SystemSetting 供 Celery 读取)
            # 注意：Celery 任务需要修改为从 SystemSetting 读取频率，或者我们接受需要重启的事实
            
            return Response({
                'message': 'OpenStack设置已保存。同步频率更改可能需要重启服务。',
                'category': 'openstack',
                'settings': os_config
            })
        except Exception as e:
            raise e

    @action(detail=False, methods=['put', 'post'])
    def save(self, request):
        """保存设置 - 自定义action"""
        category = request.data.get('category')
        settings = request.data.get('settings')
        
        if not category or not settings:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            SystemSetting.update_settings(category, settings)
            return Response({
                'message': '设置保存成功',
                'category': category,
                'settings': settings
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def category(self, request):
        """获取特定分类的设置"""
        category = request.query_params.get('name')
        if not category:
            return Response(
                {'error': '缺少category参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        settings = SystemSetting.get_settings(category)
        return Response({
            'category': category,
            'settings': settings
        })

    @action(detail=False, methods=['get'], url_path='openstack/config')
    def openstack_config(self, request):
        """获取当前 OpenStack 配置（只读，密码已掩码）"""
        try:
            config = settings.OPENSTACK_CONFIG.copy()
            
            # 掩码敏感信息
            if 'PASSWORD' in config:
                config['PASSWORD'] = '****' if config['PASSWORD'] else ''
            
            # 添加连接状态信息
            from apps.openstack.services import get_openstack_service
            try:
                openstack_service = get_openstack_service()
                is_connected = openstack_service.connection is not None
                config['_connection_status'] = 'connected' if is_connected else 'disconnected'
            except Exception as e:
                config['_connection_status'] = 'error'
                config['_connection_error'] = str(e)
            
            # 获取 SystemSetting 中的配置（包含 syncInterval）
            try:
                system_settings = SystemSetting.get_settings('openstack')
                sync_interval = system_settings.get('syncInterval', 30)
            except:
                sync_interval = 30
            
            config['syncInterval'] = sync_interval
            
            return Response({
                'config': config,
                'editable': False,
                'source': '.env file',
                'message': 'OpenStack 配置来自环境变量（只读），同步频率来自数据库。'
            })
        except Exception as e:
            logger.error(f"获取 OpenStack 配置失败: {str(e)}")
            return Response(
                {'error': f'获取配置失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='openstack/test')
    def test_openstack_connection(self, request):
        """测试当前 OpenStack 连接"""
        try:
            from apps.openstack.services import get_openstack_service
            
            openstack_service = get_openstack_service()
            
            # 尝试列出项目来测试连接
            projects = openstack_service.list_projects()
            servers = openstack_service.list_servers()
            images = openstack_service.list_images()
            
            return Response({
                'success': True,
                'message': 'OpenStack 连接测试成功',
                'details': {
                    'auth_url': settings.OPENSTACK_CONFIG.get('AUTH_URL'),
                    'project_name': settings.OPENSTACK_CONFIG.get('PROJECT_NAME'),
                    'projects_count': len(projects),
                    'servers_count': len(servers),
                    'images_count': len(images)
                }
            })
        except Exception as e:
            logger.error(f"OpenStack 连接测试失败: {str(e)}")
            return Response({
                'success': False,
                'message': 'OpenStack 连接测试失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='openstack/sync')
    def sync_openstack_data(self, request):
        """手动触发 OpenStack 数据同步"""
        try:
            from apps.openstack.utils import sync_openstack_vms_to_db
            
            # 执行同步
            result = sync_openstack_vms_to_db()
            
            return Response({
                'success': True,
                'message': 'OpenStack 数据同步完成',
                'result': result
            })
        except Exception as e:
            logger.error(f"OpenStack 数据同步失败: {str(e)}")
            return Response({
                'success': False,
                'message': 'OpenStack 数据同步失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='database/config')
    def database_config(self, request):
        """获取当前数据库配置"""
        try:
            db_config = settings.DATABASES.get('default', {}).copy()
            
            # 掩码密码
            if 'PASSWORD' in db_config:
                db_config['PASSWORD'] = '****' if db_config['PASSWORD'] else ''
            
            # 测试连接状态
            from django.db import connection
            try:
                connection.ensure_connection()
                db_config['_connection_status'] = 'connected'
                db_config['_database_name'] = connection.settings_dict.get('NAME')
            except Exception as e:
                db_config['_connection_status'] = 'error'
                db_config['_connection_error'] = str(e)
            
            return Response({
                'config': db_config,
                'editable': True,
                'source': '.env file',
                'message': '数据库配置来自环境变量。修改后需要重启服务器才能生效。'
            })
        except Exception as e:
            logger.error(f"获取数据库配置失败: {str(e)}")
            return Response(
                {'error': f'获取配置失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='database/test')
    def test_database_connection(self, request):
        """测试数据库连接（使用提供的配置）"""
        try:
            import psycopg2
            
            # 从请求中获取数据库配置
            db_config = request.data.get('config', {})
            
            # 验证必需字段
            required_fields = ['HOST', 'PORT', 'NAME', 'USER']
            for field in required_fields:
                if not db_config.get(field):
                    return Response({
                        'success': False,
                        'message': f'缺少必需字段: {field}'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # 尝试连接
            conn = psycopg2.connect(
                host=db_config['HOST'],
                port=db_config['PORT'],
                database=db_config['NAME'],
                user=db_config['USER'],
                password=db_config.get('PASSWORD', '')
            )
            
            # 获取数据库版本
            cursor = conn.cursor()
            cursor.execute('SELECT version();')
            version = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            
            return Response({
                'success': True,
                'message': '数据库连接测试成功',
                'details': {
                    'host': db_config['HOST'],
                    'port': db_config['PORT'],
                    'database': db_config['NAME'],
                    'user': db_config['USER'],
                    'version': version
                }
            })
        except Exception as e:
            logger.error(f"数据库连接测试失败: {str(e)}")
            return Response({
                'success': False,
                'message': '数据库连接测试失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='database/save')
    def save_database_config(self, request):
        """保存数据库配置到 .env 文件和 SystemSetting"""
        try:
            db_config = request.data.get('config', {})
            
            # 验证必需字段
            required_fields = ['HOST', 'PORT', 'NAME', 'USER']
            for field in required_fields:
                if not db_config.get(field):
                    return Response({
                        'success': False,
                        'message': f'缺少必需字段: {field}'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # 1. 保存到 SystemSetting 模型
            SystemSetting.update_settings('database', db_config)
            
            # 2. 更新 .env 文件
            import os
            from pathlib import Path
            
            env_path = Path(settings.BASE_DIR) / '.env'
            
            if env_path.exists():
                # 读取现有 .env 内容
                with open(env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                # 更新数据库配置行
                db_vars = {
                    'DB_HOST': db_config.get('HOST'),
                    'DB_PORT': str(db_config.get('PORT')),
                    'DB_NAME': db_config.get('NAME'),
                    'DB_USER': db_config.get('USER'),
                    'DB_PASSWORD': db_config.get('PASSWORD', '')
                }
                
                new_lines = []
                updated_vars = set()
                
                for line in lines:
                    updated = False
                    for var_name, var_value in db_vars.items():
                        if line.startswith(f'{var_name}='):
                            new_lines.append(f'{var_name}={var_value}\n')
                            updated_vars.add(var_name)
                            updated = True
                            break
                    if not updated:
                        new_lines.append(line)
                
                # 添加缺失的变量
                for var_name, var_value in db_vars.items():
                    if var_name not in updated_vars:
                        new_lines.append(f'{var_name}={var_value}\n')
                
                # 写回 .env 文件
                with open(env_path, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)
                
                return Response({
                    'success': True,
                    'message': '数据库配置已保存。请重启 Django 服务器以应用新配置。',
                    'restart_required': True
                })
            else:
                return Response({
                    'success': False,
                    'message': '.env 文件不存在'
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            logger.error(f"保存数据库配置失败: {str(e)}")
            return Response({
                'success': False,
                'message': '保存数据库配置失败',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

