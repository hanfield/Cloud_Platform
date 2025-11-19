# Celery定时任务使用指南

本项目使用Celery实现定时任务，用于自动计费和资源监控。

## 前置条件

需要安装Redis作为Celery的消息队列：

### macOS安装
```bash
brew install redis
brew services start redis
```

### Ubuntu/Linux安装
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### Windows安装
下载Redis for Windows或使用WSL

## 安装Python依赖

```bash
pip install celery redis
```

## 启动Celery

### 1. 启动Celery Worker（后台任务执行器）

```bash
cd backend
celery -A cloud_platform worker -l info
```

### 2. 启动Celery Beat（定时任务调度器）

在新的终端窗口中：

```bash
cd backend
celery -A cloud_platform beat -l info
```

## 配置的定时任务

### 1. 每日计费任务
- **任务名称**: `create_daily_billing_records`
- **执行时间**: 每天凌晨 0:10
- **功能**: 为所有信息系统生成前一天的计费记录
- **队列**: billing

### 2. 资源变更检测
- **任务名称**: `detect_resource_changes`
- **执行时间**: 每小时整点
- **功能**: 检测虚拟机资源变化并记录到ResourceAdjustmentLog
- **队列**: monitoring

### 3. 虚拟机状态同步
- **任务名称**: `sync_vm_status`
- **执行时间**: 每5分钟
- **功能**: 同步虚拟机状态，确保数据一致性
- **队列**: monitoring

## 手动执行任务

可以通过Django shell手动执行任务：

```python
python manage.py shell

from apps.information_systems.tasks import create_daily_billing_records, detect_resource_changes

# 立即执行每日计费任务
result = create_daily_billing_records.delay()
print(result.get())

# 立即执行资源变更检测
result = detect_resource_changes.delay()
print(result.get())
```

## 监控任务

### 使用Flower（推荐）

安装Flower：
```bash
pip install flower
```

启动Flower：
```bash
celery -A cloud_platform flower
```

访问 http://localhost:5555 查看任务监控面板

### 查看任务日志

Celery的日志会显示在worker和beat的终端输出中。也可以查看Django日志：

```bash
tail -f logs/django.log
```

## 生产环境部署

### 使用Supervisor管理Celery进程

创建 `/etc/supervisor/conf.d/celery.conf`：

```ini
[program:celery-worker]
command=/path/to/venv/bin/celery -A cloud_platform worker -l info
directory=/path/to/backend
user=your_user
autostart=true
autorestart=true
stderr_logfile=/var/log/celery/worker.err.log
stdout_logfile=/var/log/celery/worker.out.log

[program:celery-beat]
command=/path/to/venv/bin/celery -A cloud_platform beat -l info
directory=/path/to/backend
user=your_user
autostart=true
autorestart=true
stderr_logfile=/var/log/celery/beat.err.log
stdout_logfile=/var/log/celery/beat.out.log
```

重新加载Supervisor：
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start celery-worker
sudo supervisorctl start celery-beat
```

## Docker部署

在docker-compose.yml中添加Celery服务：

```yaml
  redis:
    image: redis:alpine
    container_name: cloud-platform-redis
    networks:
      - cloud-platform-network

  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: cloud-platform-celery-worker
    command: celery -A cloud_platform worker -l info
    volumes:
      - ./backend:/app
    depends_on:
      - postgres
      - redis
    networks:
      - cloud-platform-network

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: cloud-platform-celery-beat
    command: celery -A cloud_platform beat -l info
    volumes:
      - ./backend:/app
    depends_on:
      - postgres
      - redis
    networks:
      - cloud-platform-network
```

## 计费逻辑说明

### 每日计费规则

1. **资源快照**: 记录当天的CPU、内存、存储配置
2. **运行时间**:
   - 7x24模式: 按24小时计费
   - 5x8模式: 按8小时计费
3. **定价模型**:
   - CPU: 0.1元/核/小时
   - 内存: 0.05元/GB/小时
   - 存储: 0.01元/GB/小时
4. **折扣**: 应用租户的discount_rate

### 资源变更计费

当检测到资源配置变更时：
1. 记录到ResourceAdjustmentLog
2. 更新系统资源总量
3. 次日按新配置计费

### 查看计费记录

管理员可以通过以下API查看计费记录：
- `/api/information-systems/{id}/detailed_info/` - 查看系统详细信息，包括计费记录
- `/api/information-systems/{id}/billing_records/` - 只查看计费记录

## 故障排查

### 任务未执行
1. 检查Redis是否运行: `redis-cli ping`
2. 检查Celery Worker是否运行
3. 检查Celery Beat是否运行
4. 查看日志文件

### 任务执行失败
1. 查看Worker日志中的错误信息
2. 检查数据库连接
3. 确认任务代码没有错误

### Redis连接失败
1. 确认Redis服务正在运行
2. 检查settings.py中的CELERY_BROKER_URL配置
3. 检查防火墙设置