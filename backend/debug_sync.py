"""
调试同步功能
"""
import os
import sys
import django
import logging

# 设置 Django 环境
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')
django.setup()

# 配置日志输出到控制台
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

from apps.openstack.utils import sync_openstack_vms_to_db

print("开始手动执行同步...")
try:
    result = sync_openstack_vms_to_db()
    print(f"同步结果: {result}")
except Exception as e:
    print(f"同步发生异常: {e}")
    import traceback
    traceback.print_exc()
