# OpenStack 虚拟机同步配置说明

## 自动定时同步

系统已配置 Celery Beat 定时任务，每 5 分钟自动从 OpenStack 同步虚拟机数据，**并自动清理已删除的虚拟机记录**。

### 同步内容：
1. **虚拟机规格**：CPU核数、内存大小、磁盘容量
2. **运行状态**：运行中、已停止、暂停、异常
3. **网络信息**：IP地址、MAC地址
4. **启动时间**：自动设置 `last_start_time`，用于计算运行时长
5. **数据清理**：自动删除OpenStack中已不存在的虚拟机记录

### 定时任务配置

**位置**: `backend/cloud_platform/celery.py`

```python
# 从OpenStack同步虚拟机完整数据 - 每5分钟执行一次
'sync-openstack-vms-full': {
    'task': 'sync_openstack_vms',
    'schedule': crontab(minute='*/5'),  # 每5分钟执行
    'options': {'queue': 'monitoring'}
},
```

### 手动执行同步

如需立即同步，可以在服务器上运行：

```bash
# SSH到服务器
ssh root@192.168.101.188

# 进入项目目录
cd /opt/yunpingtai/backend

# 激活虚拟环境
source venv/bin/activate

# 预览将要同步的内容（不实际更新）
python manage.py sync_openstack_vms --dry-run

# 执行实际同步（不清理已删除的记录）
python manage.py sync_openstack_vms

# 执行同步并清理已删除的虚拟机记录
python manage.py sync_openstack_vms --cleanup-deleted

# 预览同步和清理操作
python manage.py sync_openstack_vms --dry-run --cleanup-deleted
```

### 调整同步频率

如需修改同步频率，编辑 `backend/cloud_platform/celery.py`：

```python
# 每1分钟同步一次
'schedule': crontab(minute='*/1'),

# 每10分钟同步一次
'schedule': crontab(minute='*/10'),

# 每小时同步一次
'schedule': crontab(minute=0),

# 每天凌晨2点同步一次
'schedule': crontab(hour=2, minute=0),
```

修改后需要重启 Celery Beat：

```bash
ssh root@192.168.101.188
systemctl restart celery-beat
```

### 查看同步日志

```bash
# 查看Celery日志
ssh root@192.168.101.188
tail -f /opt/yunpingtai/backend/logs/celery.log

# 查看Django日志（包含同步命令输出）
tail -f /opt/yunpingtai/backend/logs/django.log
```

### 注意事项

1. **首次部署后**，建议手动运行一次同步确保数据准确
2. **Celery服务必须运行**，定时任务才能执行
3. 同步会自动处理：
   - 同事直接在OpenStack创建的虚拟机（如果数据库中有记录）
   - OpenStack中虚拟机状态的变更
   - IP地址的分配和变更
4. **运行时长修复**：同步会为运行中的VM设置 `last_start_time`，从而正确计算 `uptime`
