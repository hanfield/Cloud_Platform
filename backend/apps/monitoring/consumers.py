"""
WebSocket Consumers for real-time updates
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import User
from urllib.parse import parse_qs

logger = logging.getLogger(__name__)


class VMStatusConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for VM status updates"""
    
    @database_sync_to_async
    def get_user_from_token(self, token_string):
        """从JWT token获取用户"""
        try:
            # 验证并解析token
            access_token = AccessToken(token_string)
            user_id = access_token['user_id']
            
            # 获取用户对象
            user = User.objects.get(id=user_id)
            if user.is_active:
                return user
            else:
                logger.warning(f"用户 {user.username} 未激活")
                return None
        except Exception as e:
            logger.error(f"Token验证失败: {str(e)}")
            return None
    
    async def connect(self):
        """处理WebSocket连接"""
        # 从查询参数中提取token
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token_list = query_params.get('token', [])
        
        if not token_list:
            logger.warning("未提供认证token，拒绝WebSocket连接")
            await self.close()
            return
        
        token = token_list[0]
        
        # 从token获取用户
        self.user = await self.get_user_from_token(token)
        
        # 验证用户认证
        if not self.user:
            logger.warning("未认证用户尝试连接WebSocket")
            await self.close()
            return
        
        # 加入VM状态更新组
        self.room_group_name = 'vm_status_updates'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"用户 {self.user.username} 已连接WebSocket")
        
        # 发送欢迎消息
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'WebSocket连接成功'
        }))

    async def disconnect(self, close_code):
        """处理WebSocket断开"""
        # 离开组
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        
        if hasattr(self, 'user'):
            logger.info(f"用户 {self.user.username} 断开WebSocket连接")

    async def receive(self, text_data):
        """接收来自WebSocket的消息"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                # 心跳响应
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
        except json.JSONDecodeError:
            logger.error(f"无效的JSON消息: {text_data}")
        except Exception as e:
            logger.error(f"处理WebSocket消息失败: {str(e)}")

    async def vm_status_update(self, event):
        """接收VM状态更新事件并发送给客户端"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'vm_status_update',
                'data': event['data']
            }))
        except Exception as e:
            logger.error(f"发送VM状态更新失败: {str(e)}")
