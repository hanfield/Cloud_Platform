#!/bin/bash
# Kylin Linux 部署脚本 - 使用预编译的前端
# 在服务器上运行

set -e

# Configuration
PROJECT_DIR="/opt/yunpingtai"
DB_NAME="cloud_platform"
DB_USER="cloud_user"
DB_PASSWORD="CloudPlatform@2025"  # 请修改为更安全的密码

echo "=========================================="
echo "开始部署云平台 (Kylin Linux)"
echo "=========================================="

# 1. 安装系统依赖（使用系统自带的 Python 3.7）
echo ""
echo ">>> 1. 检查并安装系统依赖..."

# 验证 Python 3.7 已安装
echo "Python 版本: $(python3 --version)"
if ! python3 --version | grep -q "3.7"; then
    echo "警告: 系统 Python 版本不是 3.7，可能会有兼容性问题"
fi

# 安装其他依赖
yum install -y git python3-devel gcc postgresql-server postgresql-contrib redis nginx

# 确保 pip 可用
python3 -m ensurepip --upgrade 2>/dev/null || yum install -y python3-pip

# 2. 配置数据库
echo ""
echo ">>> 2. 配置 PostgreSQL..."
# 初始化数据库（如果尚未初始化）
if [ ! -d /var/lib/pgsql/data/base ]; then
    postgresql-setup --initdb
fi

systemctl enable postgresql
systemctl start postgresql

# 创建数据库和用户
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo "配置 PostgreSQL 允许密码认证..."
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
if ! grep -q "host.*${DB_NAME}.*${DB_USER}" ${PG_HBA}; then
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" >> ${PG_HBA}
    systemctl restart postgresql
fi

# 3. 配置 Redis
echo ""
echo ">>> 3. 配置 Redis..."
systemctl enable redis
systemctl start redis

# 4. 解压后端代码
echo ""
echo ">>> 4. 解压并配置后端..."
if [ -d "${PROJECT_DIR}" ]; then
    echo "备份旧版本..."
    mv ${PROJECT_DIR} ${PROJECT_DIR}.bak.$(date +%Y%m%d_%H%M%S)
fi

mkdir -p ${PROJECT_DIR}
tar -xzf /tmp/backend.tar.gz -C ${PROJECT_DIR}
cd ${PROJECT_DIR}/backend

# 5. 创建 Python 虚拟环境
echo ""
echo ">>> 5. 创建 Python 虚拟环境..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# 6. 配置 .env
echo ""
echo ">>> 6. 配置环境变量..."
if [ ! -f .env ]; then
    cp .env.example .env
    # 生成随机 SECRET_KEY
    SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
    
    # 更新 .env 文件
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

# 7. 运行数据库迁移
echo ""
echo ">>> 7. 运行数据库迁移..."
python manage.py makemigrations
python manage.py migrate

# 8. 收集静态文件
echo ""
echo ">>> 8. 收集静态文件..."
python manage.py collectstatic --noinput

# 9. 创建超级用户（可选）
echo ""
echo ">>> 9. 创建管理员用户（可选）..."
echo "请在部署完成后手动运行: python manage.py createsuperuser"

# 10. 解压前端代码
echo ""
echo ">>> 10. 解压前端..."
mkdir -p ${PROJECT_DIR}/frontend
tar -xzf /tmp/frontend-build.tar.gz -C ${PROJECT_DIR}/frontend/

# 11. 配置 Nginx
echo ""
echo ">>> 11. 配置 Nginx..."
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

# 删除默认配置
rm -f /etc/nginx/conf.d/default.conf

# 12. 配置 Systemd 服务
echo ""
echo ">>> 12. 配置 Systemd 服务..."

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

# 创建目录
mkdir -p /var/run/celery /var/log/celery
chmod 755 /var/run/celery /var/log/celery

# 13. 启动所有服务
echo ""
echo ">>> 13. 启动服务..."
systemctl daemon-reload
systemctl enable gunicorn celery celerybeat nginx
systemctl restart gunicorn celery celerybeat nginx

# 14. 检查状态
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
