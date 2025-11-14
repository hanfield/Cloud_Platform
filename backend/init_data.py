"""
初始化数据脚本
用于创建默认管理员账号和测试数据
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')
django.setup()

from django.contrib.auth.models import User
from apps.tenants.models import Tenant
from apps.tenants.user_models import UserProfile


def create_admin_user():
    """创建默认管理员账号"""
    print("正在创建管理员账号...")

    # 检查是否已存在admin用户
    if User.objects.filter(username='admin').exists():
        print("  管理员账号已存在，跳过创建")
        admin_user = User.objects.get(username='admin')
    else:
        # 创建管理员用户
        admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            is_staff=True,
            is_superuser=True,
            is_active=True
        )
        print("  ✓ 管理员账号创建成功")
        print("    用户名: admin")
        print("    密码: admin123")

    # 创建管理员的UserProfile
    if not hasattr(admin_user, 'profile'):
        UserProfile.objects.create(
            user=admin_user,
            user_type=UserProfile.UserType.ADMIN,
            status=UserProfile.UserStatus.ACTIVE
        )
        print("  ✓ 管理员配置创建成功")
    else:
        print("  管理员配置已存在，跳过创建")

    return admin_user


def create_test_tenant():
    """创建测试租户"""
    print("\n正在创建测试租户...")

    # 检查是否已存在测试租户
    if Tenant.objects.filter(code='TEST001').exists():
        print("  测试租户已存在，跳过创建")
        tenant = Tenant.objects.get(code='TEST001')
    else:
        # 创建测试租户
        tenant = Tenant.objects.create(
            name='测试租户公司',
            code='TEST001',
            status=Tenant.Status.ACTIVE,
            level=Tenant.Level.ORDINARY,
            tenant_type=Tenant.TenantType.VIRTUAL,
            contact_person='张三',
            contact_phone='13800138000',
            contact_email='zhangsan@test.com',
            address='北京市朝阳区测试路123号',
            quota_vcpus=10,
            quota_memory=32,
            quota_disk=500
        )
        print("  ✓ 测试租户创建成功")
        print("    租户名称: 测试租户公司")
        print("    租户编码: TEST001")

    return tenant


def create_test_tenant_user(tenant):
    """创建测试租户用户"""
    print("\n正在创建测试租户用户...")

    # 检查是否已存在tenant用户
    if User.objects.filter(username='tenant').exists():
        print("  租户用户已存在，跳过创建")
        tenant_user = User.objects.get(username='tenant')
    else:
        # 创建租户用户
        tenant_user = User.objects.create_user(
            username='tenant',
            email='tenant@test.com',
            password='tenant123',
            is_active=True
        )
        print("  ✓ 租户用户创建成功")
        print("    用户名: tenant")
        print("    密码: tenant123")

    # 创建租户用户的UserProfile
    if not hasattr(tenant_user, 'profile'):
        UserProfile.objects.create(
            user=tenant_user,
            user_type=UserProfile.UserType.TENANT,
            tenant=tenant,
            status=UserProfile.UserStatus.ACTIVE,
            phone='13900139000',
            department='IT部门',
            position='测试用户'
        )
        print("  ✓ 租户用户配置创建成功")
    else:
        print("  租户用户配置已存在，跳过创建")

    return tenant_user


def main():
    """主函数"""
    print("=" * 60)
    print("云平台管理系统 - 数据初始化")
    print("=" * 60)

    try:
        # 创建管理员账号
        admin_user = create_admin_user()

        # 创建测试租户
        tenant = create_test_tenant()

        # 创建测试租户用户
        tenant_user = create_test_tenant_user(tenant)

        print("\n" + "=" * 60)
        print("数据初始化完成！")
        print("=" * 60)
        print("\n默认账号信息：")
        print("\n1. 管理员账号")
        print("   用户名: admin")
        print("   密码: admin123")
        print("   访问地址: http://localhost:3000/login")
        print("\n2. 租户测试账号")
        print("   用户名: tenant")
        print("   密码: tenant123")
        print("   访问地址: http://localhost:3000/login")
        print("\n注意：请在生产环境中修改默认密码！")
        print("=" * 60)

    except Exception as e:
        print(f"\n错误：数据初始化失败")
        print(f"错误信息：{str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == '__main__':
    exit(main())