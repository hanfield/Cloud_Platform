# 快速修复指南：运行时长显示"未运行"

## 问题

部分虚拟机显示状态为"运行中"，但运行时长显示"未运行"。

## 原因

虚拟机的 `last_start_time` 字段为空，导致无法计算运行时长。

## 解决方案

运行同步命令从 OpenStack 获取并设置启动时间：

```bash
# 1. 部署最新代码
./deploy_patch.sh 192.168.101.188

# 2. SSH到服务器
ssh root@192.168.101.188

# 3. 进入项目目录
cd /opt/yunpingtai/backend

# 4. 激活虚拟环境
source venv/bin/activate

# 5. 预览将要更新的内容
python manage.py sync_openstack_vms --dry-run

# 6. 执行实际同步
python manage.py sync_openstack_vms

# 7. 刷新前端页面查看效果
```

## 预期效果

同步后，所有运行中的虚拟机都会正确显示运行时长（如"1天2小时30分钟"）。

## 后续

系统会每5分钟自动同步一次，保持数据准确。

## 清理已删除的虚拟机记录

如果想清理数据库中但OpenStack已删除的虚拟机记录：

```python
# 进入Django shell
python manage.py shell

# 执行清理脚本
from apps.information_systems.models import VirtualMachine
from apps.openstack.services import get_openstack_service

os_service = get_openstack_service()
deleted_count = 0

for vm in VirtualMachine.objects.exclude(openstack_id__isnull=True):
    server = os_service.get_server(vm.openstack_id)
    if not server:
        print(f"删除记录: {vm.name} (OpenStack中已不存在)")
        # vm.delete()  # 取消注释以实际删除
        deleted_count += 1

print(f"总计: {deleted_count} 个虚拟机在OpenStack中不存在")
```
