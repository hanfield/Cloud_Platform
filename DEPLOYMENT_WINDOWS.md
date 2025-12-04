# Windows 部署指南

本指南将帮助您在 Windows 环境下部署云平台管理系统。

## 📋 1. 环境准备

### 1.1 安装 Python
1. 下载 Python 3.9+ 安装包：[Python Downloads](https://www.python.org/downloads/)
2. 运行安装程序，**务必勾选 "Add Python to PATH"**。
3. 验证安装：打开 CMD 或 PowerShell，输入 `python --version`。

### 1.2 安装 Node.js
1. 下载 Node.js (LTS 版本)：[Node.js Downloads](https://nodejs.org/)
2. 运行安装程序，按默认设置安装。
3. 验证安装：输入 `node -v` 和 `npm -v`。

### 1.3 安装 PostgreSQL
1. 下载 Windows 安装程序：[PostgreSQL Downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. 运行安装程序：
   - 设置超级用户密码（请记住这个密码，后续配置需要）。
   - 端口保持默认 `5432`。
3. 安装完成后，打开 pgAdmin 或 SQL Shell (psql) 验证连接。

### 1.4 安装 Redis
Windows 官方不直接支持 Redis，推荐以下两种方式之一：

*   **方案 A (推荐)**: 使用 [Memurai](https://www.memurai.com/get-memurai) (Redis 的 Windows 兼容版，开发者版免费)。
*   **方案 B**: 下载 [Redis for Windows](https://github.com/microsoftarchive/redis/releases) (微软归档版本，较旧但可用)。

安装后确保 Redis 服务已启动（默认端口 `6379`）。

---

## ⚙️ 2. 后端配置

### 2.1 获取代码
假设代码解压在 `C:\Projects\Yunpingtai`。

### 2.2 创建虚拟环境
打开 PowerShell 或 CMD，进入 `backend` 目录：

```powershell
cd C:\Projects\Yunpingtai\backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# PowerShell:
.\venv\Scripts\Activate.ps1
# CMD:
.\venv\Scripts\activate.bat
```

### 2.3 安装依赖
```powershell
pip install -r requirements.txt
```

### 2.4 配置环境变量
复制 `.env.example` 为 `.env`：

```powershell
copy .env.example .env
```

使用记事本打开 `.env` 文件，修改数据库配置：
```ini
DB_NAME=cloud_platform
DB_USER=postgres
DB_PASSWORD=您的数据库密码
DB_HOST=localhost
DB_PORT=5432
```

### 2.5 初始化数据库
```powershell
# 1. 创建数据库迁移
python manage.py makemigrations

# 2. 应用迁移
python manage.py migrate

# 3. 创建超级用户
python manage.py createsuperuser
```

### 2.6 ⚠️ 修复管理员权限
Windows 下同样需要修复管理员权限。在终端中运行：

```powershell
python manage.py shell -c "from django.contrib.auth.models import User; from apps.tenants.user_models import UserProfile; u = User.objects.get(username='admin'); UserProfile.objects.update_or_create(user=u, defaults={'user_type': 'admin', 'status': 'active', 'position': '系统管理员'}); print('管理员权限修复成功')"
```
*(请将 `username='admin'` 替换为您创建的用户名)*

---

## 💻 3. 前端配置

打开一个新的 PowerShell 窗口，进入 `frontend` 目录：

```powershell
cd C:\Projects\Yunpingtai\frontend

# 安装依赖
npm install
```

---

## 🚀 4. 启动服务

### 4.1 启动后端 API
在 `backend` 目录的终端中：

```powershell
# 确保虚拟环境已激活
python manage.py runserver
```
后端将在 `http://127.0.0.1:8000` 运行。

### 4.2 启动 Celery 任务队列 (Windows 特殊配置)
Windows 不支持 Celery 的默认进程池，需要使用 `solo` 或 `threads` 模式。

打开一个新的终端，进入 `backend` 目录，激活虚拟环境：

```powershell
# 启动 Worker (注意 -P solo 参数)
celery -A cloud_platform worker --loglevel=info -P solo
```

打开另一个终端，启动 Beat (定时任务)：
```powershell
celery -A cloud_platform beat --loglevel=info
```

### 4.3 启动前端开发服务器
在 `frontend` 目录的终端中：

```powershell
npm start
```
浏览器将自动打开 `http://localhost:3000`。

---

## 📝 常见问题

### Q: 运行脚本时提示 "禁止运行脚本"？
A: PowerShell 默认禁止运行脚本。以管理员身份打开 PowerShell，运行：
```powershell
Set-ExecutionPolicy RemoteSigned
```
选择 `Y` 确认。

### Q: Celery 报错 `ValueError: not enough values to unpack`？
A: 这是 Windows 下 Celery 4.x+ 的已知问题。请确保启动 worker 时加上 `-P solo` 参数。

### Q: 数据库连接失败？
A: 检查 PostgreSQL 服务是否在“服务”管理器中运行，并确认 `.env` 中的密码正确。
