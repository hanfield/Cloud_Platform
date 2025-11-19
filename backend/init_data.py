"""
初始化数据脚本
创建管理员用户、租户和租户用户,并填充完整的个人信息
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')
django.setup()

from django.contrib.auth.models import User
from apps.tenants.models import Tenant, Stakeholder
from apps.tenants.user_models import UserProfile
from datetime import datetime, timedelta
from django.utils import timezone

def create_initial_data():
    print("开始创建初始数据...")

    # 1. 创建管理员用户
    print("\n1. 创建管理员用户...")
    admin_user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@cloudplatform.com',
            'is_staff': True,
            'is_superuser': True,
            'first_name': '管理员',
            'last_name': '系统',
        }
    )
    if created:
        admin_user.set_password('admin123')
        admin_user.save()
        print(f"   ✓ 管理员用户创建成功: {admin_user.username}")
    else:
        print(f"   - 管理员用户已存在: {admin_user.username}")

    # 创建管理员的 UserProfile
    admin_profile, created = UserProfile.objects.get_or_create(
        user=admin_user,
        defaults={
            'user_type': UserProfile.UserType.ADMIN,
            'status': UserProfile.UserStatus.ACTIVE,
            'phone': '13800138000',
            'department': 'IT部门',
            'position': '系统管理员',
        }
    )
    if created:
        print(f"   ✓ 管理员配置创建成功")
    else:
        # 更新已存在的配置
        admin_profile.phone = '13800138000'
        admin_profile.department = 'IT部门'
        admin_profile.position = '系统管理员'
        admin_profile.save()
        print(f"   ✓ 管理员配置已更新")

    # 2. 创建测试租户
    print("\n2. 创建测试租户...")
    now = timezone.now()
    tenant, created = Tenant.objects.get_or_create(
        code='TEST001',
        defaults={
            'name': '测试租户公司',
            'tenant_type': Tenant.TenantType.VIRTUAL,
            'level': Tenant.TenantLevel.IMPORTANT,
            'status': Tenant.Status.ACTIVE,
            'contact_person': '张三',
            'contact_phone': '13900139000',
            'contact_email': 'zhangsan@test.com',
            'address': '北京市海淀区中关村大街1号',
            'start_time': now,
            'end_time': now + timedelta(days=365),
        }
    )
    if created:
        print(f"   ✓ 租户创建成功: {tenant.name}")
    else:
        print(f"   - 租户已存在: {tenant.name}")

    # 3. 创建租户用户
    print("\n3. 创建租户用户...")
    tenant_user, created = User.objects.get_or_create(
        username='tenant',
        defaults={
            'email': 'tenant@test.com',
            'is_staff': False,
            'is_superuser': False,
            'first_name': '三',
            'last_name': '张',
        }
    )
    if created:
        tenant_user.set_password('tenant123')
        tenant_user.save()
        print(f"   ✓ 租户用户创建成功: {tenant_user.username}")
    else:
        # 更新用户信息
        tenant_user.email = 'tenant@test.com'
        tenant_user.first_name = '三'
        tenant_user.last_name = '张'
        tenant_user.save()
        print(f"   ✓ 租户用户已更新: {tenant_user.username}")

    # 创建租户用户的 UserProfile
    tenant_profile, created = UserProfile.objects.get_or_create(
        user=tenant_user,
        defaults={
            'tenant': tenant,
            'user_type': UserProfile.UserType.TENANT,
            'status': UserProfile.UserStatus.ACTIVE,
            'phone': '13900139001',
            'department': '技术部',
            'position': '技术经理',
        }
    )
    if created:
        print(f"   ✓ 租户用户配置创建成功")
    else:
        # 更新已存在的配置
        tenant_profile.tenant = tenant
        tenant_profile.phone = '13900139001'
        tenant_profile.department = '技术部'
        tenant_profile.position = '技术经理'
        tenant_profile.status = UserProfile.UserStatus.ACTIVE
        tenant_profile.save()
        print(f"   ✓ 租户用户配置已更新")

    # 4. 创建干系人
    print("\n4. 创建干系人...")
    stakeholder1, created = Stakeholder.objects.get_or_create(
        tenant=tenant,
        email='zhangsan@test.com',
        defaults={
            'name': '张三',
            'phone': '13900139000',
            'position': '总经理',
            'department': '管理层',
            'stakeholder_type': Stakeholder.StakeholderType.DECISION_MAKER,
            'is_primary': True,
            'notes': '主要联系人',
        }
    )
    if created:
        print(f"   ✓ 干系人创建成功: {stakeholder1.name}")
    else:
        print(f"   - 干系人已存在: {stakeholder1.name}")

    stakeholder2, created = Stakeholder.objects.get_or_create(
        tenant=tenant,
        email='lisi@test.com',
        defaults={
            'name': '李四',
            'phone': '13900139002',
            'position': '技术总监',
            'department': '技术部',
            'stakeholder_type': Stakeholder.StakeholderType.TECHNICAL,
            'is_primary': False,
            'notes': '技术负责人',
        }
    )
    if created:
        print(f"   ✓ 干系人创建成功: {stakeholder2.name}")
    else:
        print(f"   - 干系人已存在: {stakeholder2.name}")

    # 同步租户用户到干系人
    tenant_stakeholder, created = Stakeholder.objects.get_or_create(
        tenant=tenant,
        email=tenant_user.email,
        defaults={
            'name': f'{tenant_user.last_name}{tenant_user.first_name}',
            'phone': tenant_profile.phone,
            'position': tenant_profile.position,
            'department': tenant_profile.department,
            'stakeholder_type': Stakeholder.StakeholderType.CUSTOMER,
            'is_primary': False,
            'notes': f'系统用户: {tenant_user.username}',
        }
    )
    if created:
        print(f"   ✓ 系统用户干系人创建成功: {tenant_stakeholder.name}")
    else:
        print(f"   - 系统用户干系人已存在: {tenant_stakeholder.name}")

    print("\n" + "="*50)
    print("初始数据创建完成！")
    print("="*50)
    print("\n登录信息:")
    print(f"  管理员账号: admin / admin123")
    print(f"    - 部门: {admin_profile.department}")
    print(f"    - 职位: {admin_profile.position}")
    print(f"    - 电话: {admin_profile.phone}")
    print(f"\n  租户账号: tenant / tenant123")
    print(f"    - 姓名: {tenant_user.last_name}{tenant_user.first_name}")
    print(f"    - 邮箱: {tenant_user.email}")
    print(f"    - 部门: {tenant_profile.department}")
    print(f"    - 职位: {tenant_profile.position}")
    print(f"    - 电话: {tenant_profile.phone}")
    print(f"    - 所属租户: {tenant.name}")
    print("="*50)

if __name__ == '__main__':
    create_initial_data()
