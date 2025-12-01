"""
OpenStack 连接测试脚本
"""
import os
import sys

# 添加项目路径
sys.path.insert(0, '/Users/hanli/Downloads/Yunpingtai/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')

import django
django.setup()

from apps.openstack.services import get_openstack_service

def test_openstack_connection():
    """测试 OpenStack 连接"""
    print("=" * 60)
    print("OpenStack 连接测试")
    print("=" * 60)
    
    try:
        # 获取 OpenStack 服务实例
        service = get_openstack_service()
        print("✅ OpenStack 服务初始化成功")
        
        # 测试连接
        print("\n正在测试连接...")
        
        # 1. 列出项目
        print("\n1. 测试列出项目...")
        projects = service.list_projects()
        print(f"   ✅ 成功获取 {len(projects)} 个项目")
        for project in projects[:3]:  # 只显示前3个
            print(f"      - {project['name']} (ID: {project['id']})")
        
        # 2. 列出镜像
        print("\n2. 测试列出镜像...")
        images = service.list_images()
        print(f"   ✅ 成功获取 {len(images)} 个镜像")
        for image in images[:3]:  # 只显示前3个
            print(f"      - {image['name']} (状态: {image['status']})")
        
        # 3. 列出规格
        print("\n3. 测试列出规格...")
        flavors = service.list_flavors()
        print(f"   ✅ 成功获取 {len(flavors)} 个规格")
        for flavor in flavors[:3]:  # 只显示前3个
            print(f"      - {flavor['name']} (vCPUs: {flavor['vcpus']}, RAM: {flavor['ram']}MB)")
        
        # 4. 列出虚拟机
        print("\n4. 测试列出虚拟机...")
        servers = service.list_servers()
        print(f"   ✅ 成功获取 {len(servers)} 个虚拟机实例")
        for server in servers[:3]:  # 只显示前3个
            print(f"      - {server['name']} (状态: {server['status']})")
        
        print("\n" + "=" * 60)
        print("🎉 OpenStack 连接测试成功！")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ OpenStack 连接测试失败")
        print(f"错误信息: {str(e)}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_openstack_connection()
    sys.exit(0 if success else 1)
