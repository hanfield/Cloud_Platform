#!/usr/bin/env python
"""
测试CRUD操作脚本
"""
import os
import django
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')
django.setup()

from django.contrib.auth.models import User
from apps.tenants.models import Tenant
from datetime import datetime, timedelta

def test_tenant_crud():
    print("=" * 50)
    print("测试租户CRUD操作")
    print("=" * 50)

    user, created = User.objects.get_or_create(
        username='admin',
        defaults={'is_staff': True, 'is_superuser': True}
    )
    if created:
        user.set_password('admin123')
        user.save()
        print(f"✓ 创建管理员用户: {user.username}")
    else:
        print(f"✓ 管理员用户已存在: {user.username}")

    print("\n1. 测试创建租户...")
    tenant_data = {
        'name': '测试租户公司',
        'code': 'TEST001',
        'description': '这是一个测试租户',
        'level': Tenant.TenantLevel.ORDINARY,
        'discount_level': Tenant.DiscountLevel.LEVEL_A,
        'tenant_type': Tenant.TenantType.VIRTUAL,
        'status': Tenant.Status.ACTIVE,
        'contact_person': '张三',
        'contact_phone': '13800138000',
        'contact_email': 'zhangsan@test.com',
        'address': '北京市朝阳区测试路123号',
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(days=365),
        'created_by': user,
        'quota_vcpus': 10,
        'quota_memory': 32,
        'quota_disk': 500,
        'quota_instances': 5
    }

    tenant, created = Tenant.objects.get_or_create(
        code='TEST001',
        defaults=tenant_data
    )

    if created:
        print(f"✓ 成功创建租户: {tenant.name} (ID: {tenant.id})")
    else:
        print(f"✓ 租户已存在: {tenant.name} (ID: {tenant.id})")

    print("\n2. 测试读取租户...")
    retrieved_tenant = Tenant.objects.get(id=tenant.id)
    print(f"✓ 成功读取租户: {retrieved_tenant.name}")
    print(f"  - 编码: {retrieved_tenant.code}")
    print(f"  - 状态: {retrieved_tenant.get_status_display()}")
    print(f"  - 折扣率: {retrieved_tenant.discount_rate}")

    print("\n3. 测试更新租户...")
    retrieved_tenant.description = '更新后的描述信息'
    retrieved_tenant.quota_vcpus = 20
    retrieved_tenant.save()
    print(f"✓ 成功更新租户: {retrieved_tenant.name}")
    print(f"  - 新的vCPU配额: {retrieved_tenant.quota_vcpus}")

    print("\n4. 测试查询租户...")
    active_tenants = Tenant.objects.filter(status=Tenant.Status.ACTIVE)
    print(f"✓ 活跃租户数量: {active_tenants.count()}")

    print("\n5. 测试租户列表...")
    all_tenants = Tenant.objects.all()[:5]
    for t in all_tenants:
        print(f"  - {t.name} ({t.code}) - {t.get_status_display()}")

    print("\n" + "=" * 50)
    print("所有测试通过！")
    print("=" * 50)

if __name__ == '__main__':
    try:
        test_tenant_crud()
    except Exception as e:
        print(f"\n✗ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()