# 云平台管理系统 - 部署指南

本文档提供完整的安装和部署指南，包括开发环境和生产环境。

## 目录

- [开发环境快速开始](#开发环境快速开始)
- [详细安装步骤](#详细安装步骤)
- [生产环境部署](#生产环境部署)
- [常见问题](#常见问题)
- [维护和监控](#维护和监控)

---

## 开发环境快速开始

### 环境要求

- **Python**: 3.9+
- **Node.js**: 16+
- **npm**: 8+
- **操作系统**: macOS 10.15+ / Windows 10+ / Linux (Ubuntu 20.04+)

### 快速安装

\`\`\`bash
# 1. 获取代码
cd Yunpingtai

# 2. 后端设置
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python init_data.py  # 初始化默认数据
python manage.py runserver

# 3. 前端设置（新终端）
cd frontend
npm install
npm start
\`\`\`

访问 http://localhost:3000 即可使用系统。

**默认账号**：
- 管理员：admin / admin123
- 租户用户：tenant / tenant123

---

## 详细安装步骤

### 第一步：获取项目代码

#### 方式1：从Git克隆

\`\`\`bash
git clone <repository-url>
cd Yunpingtai
\`\`\`

#### 方式2：解压压缩包

\`\`\`bash
unzip Yunpingtai.zip
cd Yunpingtai
\`\`\`

### 第二步：后端安装

#### 1. 创建Python虚拟环境

**macOS/Linux:**
\`\`\`bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
\`\`\`

**Windows (CMD):**
\`\`\`cmd
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
\`\`\`

**Windows (PowerShell):**
\`\`\`powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
\`\`\`

#### 2. 安装Python依赖

\`\`\`bash
pip install -r requirements.txt
\`\`\`

如果安装速度慢，使用国内镜像：
\`\`\`bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
\`\`\`

#### 3. 配置环境变量（可选）

\`\`\`bash
cp .env.example .env
# 编辑 .env 文件根据需要修改配置
\`\`\`

#### 4. 初始化数据库

\`\`\`bash
# 运行数据库迁移
python manage.py migrate

# 初始化默认数据（管理员账号和测试租户）
python init_data.py
\`\`\`

**init_data.py 会创建**：
- 管理员账号：username=\`admin\`, password=\`admin123\`
- 测试租户：测试租户公司
- 测试租户用户：username=\`tenant\`, password=\`tenant123\`

#### 5. 启动后端服务

\`\`\`bash
python manage.py runserver
\`\`\`

后端服务运行在 http://127.0.0.1:8000/

### 第三步：前端安装

**保持后端服务运行**，打开新终端。

#### 1. 安装Node.js依赖

\`\`\`bash
cd frontend
npm install
\`\`\`

使用国内镜像（可选）：
\`\`\`bash
npm install --registry=https://registry.npmmirror.com
\`\`\`

#### 2. 启动前端开发服务器

\`\`\`bash
npm start
\`\`\`

前端服务运行在 http://localhost:3000/

---

## 生产环境部署

### 环境要求

#### 硬件要求
- CPU: 4核心以上
- 内存: 8GB以上
- 磁盘: 100GB以上

#### 软件要求
- 操作系统: Ubuntu 20.04+ / CentOS 8+
- Python: 3.9+
- Node.js: 16+
- PostgreSQL: 13+
- Nginx: 1.18+
- Redis: 6+ (可选)

### 一、数据库配置

#### 1. 安装PostgreSQL

**Ubuntu:**
\`\`\`bash
sudo apt update
sudo apt install postgresql postgresql-contrib
\`\`\`

**CentOS:**
\`\`\`bash
sudo dnf install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
\`\`\`

#### 2. 创建数据库和用户

\`\`\`bash
sudo -u postgres psql

CREATE DATABASE cloud_platform;
CREATE USER cloud_user WITH PASSWORD 'your_secure_password';
ALTER ROLE cloud_user SET client_encoding TO 'utf8';
ALTER ROLE cloud_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE cloud_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE cloud_platform TO cloud_user;
\q
\`\`\`

### 二、后端部署

#### 1. 准备应用目录

\`\`\`bash
sudo mkdir -p /opt/cloud-platform
cd /opt/cloud-platform
git clone <repository_url> .

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
cd backend
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
\`\`\`

#### 2. 配置环境变量

创建 \`/opt/cloud-platform/backend/.env\`：

\`\`\`env
DEBUG=False
SECRET_KEY=your-very-secure-secret-key-here-change-this
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

DATABASE_ENGINE=django.db.backends.postgresql
DATABASE_NAME=cloud_platform
DATABASE_USER=cloud_user
DATABASE_PASSWORD=your_secure_password
DATABASE_HOST=localhost
DATABASE_PORT=5432

CORS_ALLOWED_ORIGINS=https://your-domain.com
\`\`\`

**重要**：
- 必须修改 \`SECRET_KEY\`，可以使用以下命令生成：
  \`\`\`bash
  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  \`\`\`
- 修改数据库密码
- 设置正确的域名

#### 3. 初始化数据库

\`\`\`bash
cd /opt/cloud-platform/backend
source ../venv/bin/activate

python manage.py migrate
python manage.py collectstatic --noinput
python init_data.py  # 创建默认管理员账号
\`\`\`

#### 4. 配置Gunicorn服务

创建 \`/etc/systemd/system/cloud-platform.service\`：

\`\`\`ini
[Unit]
Description=Cloud Platform Gunicorn Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/cloud-platform/backend
Environment="PATH=/opt/cloud-platform/venv/bin"
ExecStart=/opt/cloud-platform/venv/bin/gunicorn \
    --workers 4 \
    --bind unix:/opt/cloud-platform/backend/gunicorn.sock \
    --timeout 120 \
    --access-logfile /var/log/cloud-platform/access.log \
    --error-logfile /var/log/cloud-platform/error.log \
    cloud_platform.wsgi:application

[Install]
WantedBy=multi-user.target
\`\`\`

创建日志目录并启动服务：

\`\`\`bash
sudo mkdir -p /var/log/cloud-platform
sudo chown www-data:www-data /var/log/cloud-platform
sudo chown -R www-data:www-data /opt/cloud-platform

sudo systemctl start cloud-platform
sudo systemctl enable cloud-platform
sudo systemctl status cloud-platform
\`\`\`

### 三、前端部署

#### 1. 构建生产版本

\`\`\`bash
cd /opt/cloud-platform/frontend
npm install
npm run build
\`\`\`

#### 2. 配置Nginx

创建 \`/etc/nginx/sites-available/cloud-platform\`：

\`\`\`nginx
upstream backend {
    server unix:/opt/cloud-platform/backend/gunicorn.sock fail_timeout=0;
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS配置
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 前端静态文件
    location / {
        root /opt/cloud-platform/frontend/build;
        try_files $uri $uri/ /index.html;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;

        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Django静态文件
    location /static/ {
        alias /opt/cloud-platform/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Django媒体文件
    location /media/ {
        alias /opt/cloud-platform/backend/media/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 日志
    access_log /var/log/nginx/cloud-platform-access.log;
    error_log /var/log/nginx/cloud-platform-error.log;
}
\`\`\`

启用站点：

\`\`\`bash
sudo ln -s /etc/nginx/sites-available/cloud-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
\`\`\`

### 四、SSL证书配置

使用Let's Encrypt免费证书：

\`\`\`bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 测试自动续期
sudo certbot renew --dry-run
\`\`\`

### 五、安全加固

#### 1. 防火墙配置

\`\`\`bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
\`\`\`

#### 2. 修改默认密码

**重要**：首次部署后立即修改默认密码！

1. 登录系统（admin/admin123）
2. 进入用户管理页面
3. 修改admin和tenant的密码

#### 3. 限制数据库访问

编辑 \`/etc/postgresql/13/main/pg_hba.conf\`：

\`\`\`
local   cloud_platform   cloud_user   md5
\`\`\`

重启PostgreSQL：
\`\`\`bash
sudo systemctl restart postgresql
\`\`\`

---

## 常见问题

### 1. Python版本问题

**问题**：提示Python版本过低

**解决**：
\`\`\`bash
python --version  # 检查版本
python3 --version
\`\`\`

### 2. pip安装依赖失败

**解决方案1**：使用国内镜像
\`\`\`bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
\`\`\`

**解决方案2**：升级pip
\`\`\`bash
pip install --upgrade pip
\`\`\`

### 3. 端口被占用

**后端（8000端口）：**
\`\`\`bash
python manage.py runserver 8001
\`\`\`

**前端（3000端口）：**
\`\`\`bash
PORT=3001 npm start
\`\`\`

### 4. 数据库迁移错误

\`\`\`bash
# 删除数据库文件（仅开发环境）
rm db.sqlite3

# 重新迁移
python manage.py migrate
python init_data.py
\`\`\`

### 5. 前端无法连接后端

**检查清单**：
1. 确认后端服务正在运行
2. 检查防火墙设置
3. 清除浏览器缓存
4. 检查前端代理配置

### 6. Gunicorn服务无法启动

\`\`\`bash
# 检查服务状态
sudo systemctl status cloud-platform

# 查看详细日志
sudo journalctl -u cloud-platform -n 100

# 检查权限
sudo chown -R www-data:www-data /opt/cloud-platform
\`\`\`

---

## 维护和监控

### 日志查看

\`\`\`bash
# 应用日志
sudo tail -f /var/log/cloud-platform/access.log
sudo tail -f /var/log/cloud-platform/error.log

# Nginx日志
sudo tail -f /var/log/nginx/cloud-platform-access.log
sudo tail -f /var/log/nginx/cloud-platform-error.log

# 系统日志
sudo journalctl -u cloud-platform -f
\`\`\`

### 数据库备份

创建备份脚本 \`/opt/cloud-platform/backup.sh\`：

\`\`\`bash
#!/bin/bash
BACKUP_DIR="/opt/backups/cloud-platform"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump -U cloud_user cloud_platform > $BACKUP_DIR/db_$DATE.sql

# 备份媒体文件
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /opt/cloud-platform/backend/media

# 删除30天前的备份
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
\`\`\`

设置定时备份：

\`\`\`bash
chmod +x /opt/cloud-platform/backup.sh

# 添加到crontab（每天凌晨2点）
sudo crontab -e
# 添加以下行：
0 2 * * * /opt/cloud-platform/backup.sh >> /var/log/cloud-platform/backup.log 2>&1
\`\`\`

### 更新部署

\`\`\`bash
cd /opt/cloud-platform

# 拉取最新代码
git pull

# 更新后端
cd backend
source ../venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# 重启后端服务
sudo systemctl restart cloud-platform

# 更新前端
cd ../frontend
npm install
npm run build

# 重启Nginx
sudo systemctl reload nginx
\`\`\`

### 性能优化

#### 1. 启用Redis缓存（可选）

\`\`\`bash
# 安装Redis
sudo apt install redis-server

# 在requirements.txt添加
django-redis

# 在settings.py配置
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
\`\`\`

#### 2. 数据库优化

编辑 \`/etc/postgresql/13/main/postgresql.conf\`：

\`\`\`
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 4MB
\`\`\`

重启PostgreSQL：
\`\`\`bash
sudo systemctl restart postgresql
\`\`\`

---

## 技术支持

### 检查清单

遇到问题时，请检查：

1. 日志文件：\`backend/logs/django.log\`
2. 浏览器控制台错误
3. 后端终端输出
4. 系统服务状态

### 相关文档

- [README.md](./README.md) - 项目概述和功能说明
- [API.md](./API.md) - API接口文档

---

## 安全建议

### 生产环境必做事项

- [ ] 修改默认管理员密码
- [ ] 更改SECRET_KEY
- [ ] 设置DEBUG=False
- [ ] 配置ALLOWED_HOSTS
- [ ] 启用HTTPS
- [ ] 配置防火墙
- [ ] 设置数据库备份
- [ ] 定期更新依赖包
- [ ] 配置日志监控
- [ ] 限制数据库访问

祝部署顺利！