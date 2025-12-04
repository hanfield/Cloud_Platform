"""
审计日志中间件
自动记录API请求的审计日志
"""
import json
import logging
from django.utils.deprecation import MiddlewareMixin
from apps.monitoring.models import ActivityLog

logger = logging.getLogger(__name__)


class AuditLogMiddleware(MiddlewareMixin):
    """
    审计日志中间件
    自动记录所有API请求的详细信息
    """
    
    # 需要记录的HTTP方法
    AUDIT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
    
    # 需要排除的路径（不记录）
    EXCLUDE_PATHS = [
        '/api/monitoring/resources/',  # 系统资源监控，请求频繁
        '/api/monitoring/overview/',
        '/api/monitoring/vm-history/',
        '/admin/',  # Django admin
        '/static/',
        '/media/',
    ]
    
    # 敏感字段（记录时脱敏）
    SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key']
    
    def process_request(self, request):
        """在请求处理前记录请求开始"""
        # 保存原始请求体（用于后续记录）
        if request.method in self.AUDIT_METHODS:
            try:
                # Django会消费request.body，这里先读取并缓存
                request._audit_body = request.body
            except Exception:
                request._audit_body = None
        return None
    
    def process_response(self, request, response):
        """在响应返回后记录审计日志"""
        # 检查是否需要记录
        if not self._should_audit(request):
            return response
        
        try:
            # 提取请求信息
            user = request.user if request.user.is_authenticated else None
            ip_address = self._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
            request_path = request.path
            request_method = request.method
            
            # 确定操作类型和资源信息
            action_type, resource_type, resource_id, resource_name = self._parse_request(request, response)
            
            # 提取变更详情
            changes = self._extract_changes(request, response)
            
            # 确定状态
            status = 'success' if 200 <= response.status_code < 400 else 'failed'
            error_message = None
            if status == 'failed':
                try:
                    error_data = json.loads(response.content)
                    error_message = str(error_data.get('error') or error_data.get('detail') or '')[:500]
                except:
                    error_message = f'HTTP {response.status_code}'
            
            # 生成描述
            description = self._generate_description(action_type, resource_type, resource_name, request)
            
            # 记录审计日志
            ActivityLog.log_activity(
                action_type=action_type,
                description=description,
                user=user,
                ip_address=ip_address,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name,
                changes=changes,
                status=status,
                error_message=error_message,
                user_agent=user_agent,
                request_path=request_path,
                request_method=request_method
            )
        except Exception as e:
            # 审计日志记录失败不应影响正常请求
            logger.error(f'审计日志记录失败: {str(e)}')
        
        return response
    
    def _should_audit(self, request):
        """判断是否需要记录审计日志"""
        # 只记录特定HTTP方法
        if request.method not in self.AUDIT_METHODS:
            return False
        
        # 检查是否在排除列表中
        for exclude_path in self.EXCLUDE_PATHS:
            if request.path.startswith(exclude_path):
                return False
        
        return True
    
    def _get_client_ip(self, request):
        """获取客户端IP地址"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def _parse_request(self, request, response):
        """解析请求，提取操作类型和资源信息"""
        path = request.path
        method = request.method
        
        # 根据路径和方法确定操作类型
        action_type_map = {
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }
        action_type = action_type_map.get(method, 'system')
        
        # 解析资源类型和ID
        resource_type = 'other'
        resource_id = None
        resource_name = None
        
        # 虚拟机相关
        if '/virtual-machines/' in path or '/vms/' in path:
            resource_type = 'vm'
            if '/start/' in path:
                action_type = 'start'
            elif '/stop/' in path:
                action_type = 'stop'
            elif '/restart/' in path or '/reboot/' in path:
                action_type = 'restart'
            elif '/resize/' in path:
                action_type = 'resize'
            # 提取VM ID（从路径中）
            parts = path.split('/')
            for i, part in enumerate(parts):
                if part in ['virtual-machines', 'vms'] and i + 1 < len(parts):
                    resource_id = parts[i + 1]
                    break
        
        # 镜像相关
        elif '/images/' in path:
            resource_type = 'image'
            if method == 'POST' and 'upload' in path.lower():
                action_type = 'upload'
            parts = path.split('/')
            for i, part in enumerate(parts):
                if part == 'images' and i + 1 < len(parts):
                    resource_id = parts[i + 1]
                    break
        
        # 快照相关
        elif '/snapshots/' in path:
            resource_type = 'snapshot'
            if '/restore/' in path:
                action_type = 'restore'
            elif method == 'POST' and not '/restore/' in path:
                action_type = 'snapshot'
            parts = path.split('/')
            for i, part in enumerate(parts):
                if part == 'snapshots' and i + 1 < len(parts):
                    resource_id = parts[i + 1]
                    break
        
        # 告警规则相关
        elif '/alert-rules/' in path:
            resource_type = 'alert_rule'
            parts = path.split('/')
            for i, part in enumerate(parts):
                if part == 'alert-rules' and i + 1 < len(parts):
                    resource_id = parts[i + 1]
                    break
        
        # 租户相关
        elif '/tenants/' in path:
            resource_type = 'tenant'
        
        # 用户相关
        elif '/users/' in path:
            resource_type = 'user'
        
        # 信息系统相关
        elif '/information-systems/' in path:
            resource_type = 'system'
        
        # 尝试从请求/响应中获取资源名称
        try:
            if method == 'POST' and hasattr(request, '_audit_body') and request._audit_body:
                body_data = json.loads(request._audit_body)
                resource_name = body_data.get('name') or body_data.get('title')
            elif response.status_code in [200, 201]:
                response_data = json.loads(response.content)
                resource_name = response_data.get('name') or response_data.get('title')
        except:
            pass
        
        return action_type, resource_type, resource_id, resource_name
    
    def _extract_changes(self, request, response):
        """提取变更详情"""
        if request.method not in ['PUT', 'PATCH']:
            return None
        
        try:
            if hasattr(request, '_audit_body') and request._audit_body:
                changes = json.loads(request._audit_body)
                # 脱敏处理
                return self._sanitize_data(changes)
        except:
            return None
        
        return None
    
    def _sanitize_data(self, data):
        """脱敏处理敏感字段"""
        if not isinstance(data, dict):
            return data
        
        sanitized = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in self.SENSITIVE_FIELDS):
                sanitized[key] = '***'
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_data(value)
            else:
                sanitized[key] = value
        
        return sanitized
    
    def _generate_description(self, action_type, resource_type, resource_name, request):
        """生成操作描述"""
        action_map = {
            'create': '创建',
            'update': '更新',
            'delete': '删除',
            'start': '启动',
            'stop': '停止',
            'restart': '重启',
            'resize': '调整配置',
            'snapshot': '创建快照',
            'restore': '恢复快照',
            'upload': '上传',
        }
        
        resource_map = {
            'vm': '虚拟机',
            'image': '镜像',
            'snapshot': '快照',
            'alert_rule': '告警规则',
            'tenant': '租户',
            'user': '用户',
            'system': '信息系统',
            'network': '网络',
        }
        
        action_text = action_map.get(action_type, action_type)
        resource_text = resource_map.get(resource_type, resource_type)
        
        if resource_name:
            return f"{action_text}{resource_text}: {resource_name}"
        else:
            return f"{action_text}{resource_text}"
