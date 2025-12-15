#!/bin/bash
# Kylin Linux 完整部署脚本（包含 Node.js）
# 在服务器上运行

set -e

# Configuration
PROJECT_DIR="/opt/yunpingtai"
REPO_URL="https://github.com/hanfield/Cloud_Platform.git"
DB_NAME="cloud_platform"
DB_USER="cloud_user"
DB_PASSWORD="CloudPlatform@2025"  # 请修改为更安全的密码

echo "=========================================="
echo "开始部署云平台 (Kylin Linux - 完整版)"
echo "=========================================="

# 1. 验证 Python 并安装系统依赖
echo ""
echo ">>> 1. 检查系统环境并安装依赖..."
echo "Python 版本: $(python3 --version)"

# 安装系统依赖
yum install -y git python3-devel gcc postgresql-server postgresql-contrib redis nginx

# 确保 pip 可用
python3 -m ensurepip --upgrade 2>/dev/null || yum install -y python3-pip

# 2. 安装 Node.js
echo ""
echo ">>> 2. 安装 Node.js..."
if ! command -v node &> /dev/null; then
    # 先尝试从 yum 源安装
    if yum install -y nodejs npm; then
        echo "Node.js 从 yum 源安装成功"
    else
        echo "yum 源中没有 Node.js，使用二进制安装..."
        cd /tmp
        wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz
        tar -xf node-v16.20.2-linux-x64.tar.xz
        mv node-v16.20.2-linux-x64 /usr/local/node
        ln -sf /usr/local/node/bin/node /usr/bin/node
        ln -sf /usr/local/node/bin/npm /usr/bin/npm
        ln -sf /usr/local/node/bin/npx /usr/bin/npx
    fi
else
    echo "Node.js 已安装: $(node --version)"
fi

# 3. 配置数据库
echo ""
echo ">>> 3. 配置 PostgreSQL..."

# 尝试安装 PostgreSQL 13 (离线模式需确保 yum 源中有包)
if yum list installed postgresql13-server >/dev/null 2>&1 || yum list available postgresql13-server >/dev/null 2>&1; then
    echo "发现 PostgreSQL 13..."
    yum install -y postgresql13-server postgresql13-contrib
    PG_VERSION=13
    PG_SETUP="/usr/pgsql-13/bin/postgresql-13-setup"
    PG_SERVICE="postgresql-13"
    PG_DATA="/var/lib/pgsql/13/data"
    
    # 创建软链接
    ln -sf /usr/pgsql-13/bin/psql /usr/bin/psql
else
    echo "未发现 PostgreSQL 13，尝试安装默认版本..."
    yum install -y postgresql-server postgresql-contrib
    PG_VERSION="default"
    PG_SETUP="postgresql-setup"
    PG_SERVICE="postgresql"
    PG_DATA="/var/lib/pgsql/data"
fi

# 初始化数据库
if [ "$PG_VERSION" = "13" ]; then
    if [ ! -d "$PG_DATA/base" ]; then
        $PG_SETUP initdb
    fi
else
    if [ ! -d "$PG_DATA/base" ]; then
        $PG_SETUP --initdb
    fi
fi

systemctl enable $PG_SERVICE
systemctl start $PG_SERVICE

# 创建数据库和用户
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# 配置 PostgreSQL 允许密码认证
echo ""
echo ">>> 配置 PostgreSQL 认证..."
# 动态确定数据目录
if [ -d "/var/lib/pgsql/13/data" ]; then
    PG_DATA_DIR="/var/lib/pgsql/13/data"
    PG_SERVICE_NAME="postgresql-13"
else
    PG_DATA_DIR="/var/lib/pgsql/data"
    PG_SERVICE_NAME="postgresql"
fi

PG_HBA="${PG_DATA_DIR}/pg_hba.conf"
if ! grep -q "host.*${DB_NAME}.*${DB_USER}" ${PG_HBA}; then
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" >> ${PG_HBA}
    systemctl restart ${PG_SERVICE_NAME}
fi

# 4. 配置 Redis
echo ""
echo ">>> 4. 配置  Redis..."
systemctl enable redis
systemctl start redis

# 5. 解压项目代码
echo ""
echo ">>> 5. 解压项目代码..."
if [ -d "${PROJECT_DIR}" ]; then
    echo "备份旧版本..."
    mv ${PROJECT_DIR} ${PROJECT_DIR}.bak.$(date +%Y%m%d_%H%M%S)
fi

mkdir -p ${PROJECT_DIR}
tar -xzf /tmp/yunpingtai.tar.gz -C ${PROJECT_DIR}
cd ${PROJECT_DIR}

# 6. 配置后端
echo ""
echo ">>> 6. 配置后端..."
cd ${PROJECT_DIR}/backend

# 创建 Python 虚拟环境
python3 -m venv venv
source venv/bin/activate
#pip install --upgrade pip
#pip install -r requirements-py37.txt
#pip install gunicorn

# 配置 .env
if [ ! -f .env ]; then
    cp .env.example .env
    SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
    
    sed -i "s|DB_ENGINE=.*|DB_ENGINE=django.db.backends.postgresql|" .env
    sed -i "s|DB_NAME=.*|DB_NAME=${DB_NAME}|" .env
    sed -i "s|DB_USER=.*|DB_USER=${DB_USER}|" .env
    sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" .env
    sed -i "s|DB_HOST=.*|DB_HOST=localhost|" .env
    sed -i "s|DB_PORT=.*|DB_PORT=5432|" .env
    sed -i "s|SECRET_KEY=.*|SECRET_KEY=${SECRET}|" .env
    sed -i "s|DEBUG=.*|DEBUG=False|" .env
    sed -i "s|ALLOWED_HOSTS=.*|ALLOWED_HOSTS=*|" .env
fi

# 运行数据库迁移
echo ""
echo ">>> 7. 运行数据库迁移..."
python manage.py makemigrations
python manage.py migrate

# 收集静态文件
echo ""
echo ">>> 8. 收集静态文件..."
python manage.py collectstatic --noinput

# 7. 编译前端
echo ""
echo ">>> 9. 编译前端..."
cd ${PROJECT_DIR}/frontend
npm install
npm run build

# 8. 配置 Nginx
echo ""
echo ">>> 10. 配置 Nginx..."
cat > /etc/nginx/conf.d/yunpingtai.conf <<EOF
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        root ${PROJECT_DIR}/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Static files
    location /static/ {
        alias ${PROJECT_DIR}/backend/staticfiles/;
    }
}
EOF

rm -f /etc/nginx/conf.d/default.conf

# 9. 配置 Systemd 服务
echo ""
echo ">>> 11. 配置 Systemd 服务..."

# Gunicorn
cat > /etc/systemd/system/gunicorn.service <<EOF
[Unit]
Description=Gunicorn daemon for Cloud Platform
After=network.target postgresql.service

[Service]
Type=notify
User=root
Group=root
WorkingDirectory=${PROJECT_DIR}/backend
Environment="PATH=${PROJECT_DIR}/backend/venv/bin"
ExecStart=${PROJECT_DIR}/backend/venv/bin/gunicorn \\
    --workers 3 \\
    --bind 127.0.0.1:8000 \\
    --timeout 300 \\
    --access-logfile /var/log/gunicorn_access.log \\
    --error-logfile /var/log/gunicorn_error.log \\
    cloud_platform.wsgi:application
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Celery Worker
cat > /etc/systemd/system/celery.service <<EOF
[Unit]
Description=Celery Worker for Cloud Platform
After=network.target redis.service

[Service]
Type=forking
User=root
Group=root
WorkingDirectory=${PROJECT_DIR}/backend
Environment="PATH=${PROJECT_DIR}/backend/venv/bin"
ExecStart=${PROJECT_DIR}/backend/venv/bin/celery -A cloud_platform multi start worker1 \\
    --pidfile=/var/run/celery/%n.pid \\
    --logfile=/var/log/celery/%n%I.log \\
    --loglevel=INFO
ExecStop=${PROJECT_DIR}/backend/venv/bin/celery multi stopwait worker1 \\
    --pidfile=/var/run/celery/%n.pid
ExecReload=${PROJECT_DIR}/backend/venv/bin/celery -A cloud_platform multi restart worker1 \\
    --pidfile=/var/run/celery/%n.pid \\
    --logfile=/var/log/celery/%n%I.log \\
    --loglevel=INFO

[Install]
WantedBy=multi-user.target
EOF

# Celery Beat
cat > /etc/systemd/system/celerybeat.service <<EOF
[Unit]
Description=Celery Beat for Cloud Platform
After=network.target redis.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${PROJECT_DIR}/backend
Environment="PATH=${PROJECT_DIR}/backend/venv/bin"
ExecStart=${PROJECT_DIR}/backend/venv/bin/celery -A cloud_platform beat \\
    --pidfile=/var/run/celery/beat.pid \\
    --logfile=/var/log/celery/beat.log \\
    --loglevel=INFO

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /var/run/celery /var/log/celery
chmod 755 /var/run/celery /var/log/celery

# 10. 启动所有服务
echo ""
echo ">>> 12. 启动服务..."
systemctl daemon-reload
systemctl enable gunicorn celery celerybeat nginx
systemctl restart gunicorn celery celerybeat nginx

# 11. 检查状态
echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "服务状态:"
systemctl status gunicorn --no-pager | head -5
systemctl status celery --no-pager | head -5
systemctl status nginx --no-pager | head -5
echo ""
echo "访问地址: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "创建管理员账户:"
echo "cd ${PROJECT_DIR}/backend"
echo "source venv/bin/activate"
echo "python manage.py createsuperuser"
echo ""
echo "查看日志:"
echo "  - Gunicorn: tail -f /var/log/gunicorn_error.log"
echo "  - Celery: tail -f /var/log/celery/worker1.log"
echo "  - Nginx: tail -f /var/log/nginx/error.log"
echo ""
