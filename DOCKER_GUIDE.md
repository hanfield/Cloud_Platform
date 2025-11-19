# Docker 一键运行指南

本指南说明如何使用Docker快速运行云平台管理系统。

## 前提条件

### 安装Docker

#### Windows / macOS
1. 下载并安装 [Docker Desktop](https://www.docker.com/get-started)
2. 启动Docker Desktop
3. 等待Docker图标显示为绿色（运行中）

#### Linux
\`\`\`bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到docker组（避免每次使用sudo）
sudo usermod -aG docker $USER
# 注销并重新登录以使更改生效
\`\`\`

## 快速启动

### Windows用户

1. 双击运行 \`start.bat\`
2. 等待服务启动（首次运行需要下载依赖，约3-5分钟）
3. 浏览器访问 http://localhost:3000

### macOS/Linux用户

1. 打开终端，进入项目目录
2. 运行启动脚本：
   \`\`\`bash
   ./start.sh
   \`\`\`
3. 等待服务启动
4. 浏览器访问 http://localhost:3000

### 手动启动（所有平台）

\`\`\`bash
# 构建并启动所有服务
docker-compose up --build -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
\`\`\`

## 默认账号

启动成功后，使用以下账号登录：

- **管理员账号**
  - 用户名: \`admin\`
  - 密码: \`admin123\`

- **租户测试账号**
  - 用户名: \`tenant\`
  - 密码: \`tenant123\`

## 访问地址

- **前端界面**: http://localhost:3000
- **后端API**: http://localhost:8000
- **管理后台**: http://localhost:8000/admin

## 常用命令

### 查看服务状态
\`\`\`bash
docker-compose ps
\`\`\`

### 查看日志
\`\`\`bash
# 查看所有服务日志
docker-compose logs -f

# 只查看后端日志
docker-compose logs -f backend

# 只查看前端日志
docker-compose logs -f frontend
\`\`\`

### 停止服务
\`\`\`bash
docker-compose down
\`\`\`

### 重启服务
\`\`\`bash
docker-compose restart
\`\`\`

### 重新构建
\`\`\`bash
# 重新构建并启动
docker-compose up --build -d
\`\`\`

### 清理所有数据
\`\`\`bash
# 停止并删除容器、网络、卷
docker-compose down -v
\`\`\`

## 端口占用问题

如果3000或8000端口被占用，可以修改 \`docker-compose.yml\` 文件：

\`\`\`yaml
services:
  backend:
    ports:
      - "8001:8000"  # 改为8001端口

  frontend:
    ports:
      - "3001:3000"  # 改为3001端口
\`\`\`

## 数据持久化

Docker容器中的数据会保存在以下位置：

- **PostgreSQL数据库**: Docker卷 `postgres-data`
- **静态文件**: Docker卷 `backend-static`
- **媒体文件**: Docker卷 `backend-media`

即使删除容器，这些数据也会保留。

## 故障排查

### 1. Docker未启动

**错误信息**: "Cannot connect to the Docker daemon"

**解决方法**: 启动Docker Desktop

### 2. 端口被占用

**错误信息**: "port is already allocated"

**解决方法**:
- 关闭占用端口的程序
- 或修改docker-compose.yml使用其他端口

### 3. 构建失败

**解决方法**:
\`\`\`bash
# 清理并重新构建
docker-compose down
docker-compose build --no-cache
docker-compose up -d
\`\`\`

### 4. 前端无法连接后端

**检查**:
1. 确认后端服务正在运行: \`docker-compose ps\`
2. 查看后端日志: \`docker-compose logs backend\`
3. 确认网络连接: \`docker network ls\`

### 5. 数据库迁移错误

**解决方法**:
\`\`\`bash
# 进入后端容器
docker-compose exec backend bash

# 手动运行迁移
python manage.py migrate

# 重新初始化数据
python init_data.py
\`\`\`

## 进入容器调试

### 进入后端容器
\`\`\`bash
docker-compose exec backend bash

# 在容器内可以运行Django命令
python manage.py shell
python manage.py createsuperuser
\`\`\`

### 进入前端容器
\`\`\`bash
docker-compose exec frontend sh

# 在容器内可以运行npm命令
npm install
npm run build
\`\`\`

## 性能优化

### 1. 增加Docker资源

在Docker Desktop设置中：
- 增加CPU核心数（推荐4核）
- 增加内存（推荐4GB）
- 增加磁盘空间

### 2. 使用生产模式

编辑 \`docker-compose.yml\`，修改环境变量：
\`\`\`yaml
environment:
  - DEBUG=False
\`\`\`

## 更新应用

当代码更新后：

\`\`\`bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up --build -d
\`\`\`

## 备份和恢复

### 备份数据

**备份PostgreSQL数据库**:
```bash
# 使用pg_dump备份
docker-compose exec postgres pg_dump -U postgres cloud_platform > backup.sql

# 或使用Django备份
docker-compose exec backend python manage.py dumpdata > backup.json
```

### 恢复数据

**恢复PostgreSQL数据库**:
```bash
# 从SQL文件恢复
docker-compose exec -T postgres psql -U postgres cloud_platform < backup.sql

# 或从Django JSON恢复
docker-compose exec backend python manage.py loaddata backup.json
```

## 卸载

完全删除所有Docker资源：

\`\`\`bash
# 停止并删除容器、网络、卷
docker-compose down -v

# 删除镜像
docker rmi $(docker images | grep cloud-platform | awk '{print $3}')
\`\`\`

## 技术支持

如遇问题，请检查：
1. Docker Desktop是否正常运行
2. 端口是否被占用
3. 查看容器日志: \`docker-compose logs\`
4. 查看系统资源是否充足

更多信息请参考：
- [README.md](./README.md) - 项目说明
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 详细部署指南
- [API.md](./API.md) - API文档