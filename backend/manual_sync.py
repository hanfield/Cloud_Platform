"""
手动运行一次完整同步，并显示获取到的配置
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')
django.setup()

from apps.openstack.utils import sync_openstack_vms_to_db

print("执行同步...")
result = sync_openstack_vms_to_db()
print(f"\n同步结果: {result}")

# 显示更新后的虚拟机配置
from apps.information_systems.models import VirtualMachine

print("\n当前数据库中的虚拟机配置:")
vms = VirtualMachine.objects.exclude(name='Test VM').order_by('name')
for vm in vms:
    print(f"{vm.name}: {vm.cpu_cores}C | {vm.memory_gb}GB RAM | {vm.disk_gb}GB Disk | {vm.status}")
