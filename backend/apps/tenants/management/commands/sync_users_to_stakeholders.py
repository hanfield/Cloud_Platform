"""
同步所有已激活用户到干系人列表的管理命令
"""
from django.core.management.base import BaseCommand
from apps.tenants.user_models import UserProfile
from apps.tenants.user_views import sync_user_to_stakeholder


class Command(BaseCommand):
    help = '同步所有已激活和已暂停状态的用户到对应租户的干系人列表'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅显示将要同步的用户，不执行实际同步',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # 获取所有需要同步的用户（active 或 suspended 状态且有关联租户）
        profiles = UserProfile.objects.filter(
            status__in=[UserProfile.UserStatus.ACTIVE, UserProfile.UserStatus.SUSPENDED],
            tenant__isnull=False
        ).select_related('user', 'tenant')
        
        self.stdout.write(f'找到 {profiles.count()} 个需要同步的用户')
        
        synced_count = 0
        for profile in profiles:
            if dry_run:
                self.stdout.write(
                    f'  [DRY-RUN] 将同步用户 {profile.user.username} 到租户 {profile.tenant.name} ({profile.status})'
                )
            else:
                try:
                    sync_user_to_stakeholder(profile)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  已同步用户 {profile.user.username} 到租户 {profile.tenant.name}'
                        )
                    )
                    synced_count += 1
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'  同步用户 {profile.user.username} 失败: {str(e)}'
                        )
                    )
        
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'\n[DRY-RUN] 共 {profiles.count()} 个用户将被同步'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\n成功同步 {synced_count} 个用户到干系人列表'
            ))
