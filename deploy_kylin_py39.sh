#!/bin/bash
# Kylin Linux 部署脚本 - 使用 Python 3.9
# 在服务器上运行

set -e

# Configuration
PROJECT_DIR="/opt/yunpingtai"
DB_NAME="cloud_platform"
DB_USER="admin"
DB_PASSWORD="CloudPlatform@2025"

echo "=========================================="
echo "开始部署云平台 (Python 3.9)"
echo "=========================================="

# 验证 Python 3.9
echo ""
echo ">>> 1. 验证 Python 3.9..."
if ! command -v python3.9 &> /dev/null; then
    echo "错误: Python 3.9 未找到！"
    echo "请先安装 Python 3.9.7"
    exit 1
fi

echo "Python 版本: $(python3.9 --version)"

# 安装系统依赖
echo ""
echo ">>> 2. 安装系统依赖..."
yum install -y git python3-devel gcc postgresql-server postgresql-contrib redis nginx

# 安装 Node.js
echo ""
echo ">>> 3. 安装 Node.js..."
if ! command -v node &> /dev/null; then
    if yum install -y nodejs npm; then
        echo "Node.js 安装成功"
    else
        echo "从二进制安装 Node.js..."
        cd /tmp
        wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz
        tar -xf node-v16.20.2-linux-x64.tar.xz
        mv node-v16.20.2-linux-x64 /usr/local/node
        ln -sf /usr/local/node/bin/node /usr/bin/node
        ln -sf /usr/local/node/bin/npm /usr/bin/npm
    fi
fi

# 配置 PostgreSQL
echo ""
echo ">>> 4. 配置 PostgreSQL..."
if [ ! -d /var/lib/pgsql/data/base ]; then
    postgresql-setup --initdb
fi

systemctl enable postgresql
systemctl start postgresql

# 创建数据库
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# 配置 pg_hba.conf
PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
if ! grep -q "host.*${DB_NAME}.*${DB_USER}" ${PG_HBA}; then
    echo "host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    md5" >> ${PG_HBA}
    systemctl restart postgresql
fi

# 配置 Redis
echo ""
echo ">>> 5. 配置 Redis..."
systemctl enable redis
systemctl start redis

# 解压项目
echo ""
echo ">>> 6. 解压项目..."
if [ -d "${PROJECT_DIR}" ]; then
    mv ${PROJECT_DIR} ${PROJECT_DIR}.bak.$(date +%Y%m%d_%H%M%S)
fi

mkdir -p ${PROJECT_DIR}
tar -xzf /tmp/yunpingtai.tar.gz -C ${PROJECT_DIR}

# 配置后端
echo ""
echo ">>> 7. 配置后端..."
cd ${PROJECT_DIR}/backend

# 使用 Python 3.9 创建虚拟环境
python3.9 -m venv venv
source venv/bin/activate

# 安装依赖（Django 3.2 兼容 PostgreSQL 10.5）
pip install --upgrade pip
pip install Django==3.2.25
pip install djangorestframework==3.14.0
pip install djangorestframework-simplejwt==5.2.2
pip install django-cors-headers==3.14.0
pip install psycopg2-binary==2.9.6
pip install openstacksdk==1.5.0
pip install python-dotenv
pip install python-decouple==3.8
pip install django-filter==22.1
pip install "celery[redis]==5.2.7"
pip install redis==4.5.5
pip install Pillow==9.5.0
pip install python-dateutil==2.9.0.post0
pip install pytz==2023.3
pip install requests==2.31.0
pip install psutil==5.9.6
pip install gunicorn
pip install "importlib-metadata<5.0"
pip install typing-extensions

echo "已安装 Django 3.2.25（兼容 PostgreSQL 10.5）"

# 配置 .env（总是重新创建以确保正确）
SECRET=$(python3.9 -c 'import secrets; print(secrets.token_urlsafe(50))')

cat > .env << ENDOFENV
SECRET_KEY=${SECRET}
DEBUG=False
ALLOWED_HOSTS=*

DB_ENGINE=django.db.backends.postgresql
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=127.0.0.1
DB_PORT=5432

OPENSTACK_AUTH_URL=http://192.168.100.105:5000/v3
OPENSTACK_USERNAME=admin
OPENSTACK_PASSWORD=your-password
OPENSTACK_PROJECT_NAME=admin
OPENSTACK_USER_DOMAIN_NAME=DEFAULT
OPENSTACK_PROJECT_DOMAIN_NAME=DEFAULT
OPENSTACK_REGION_NAME=RegionOne
ENDOFENV

chmod 600 .env
echo ".env 文件已创建"

# 数据库迁移
echo ""
echo ">>> 8. 数据库迁移..."
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic --noinput

# 编译前端
echo ""
echo ">>> 9. 编译前端..."
cd ${PROJECT_DIR}/frontend
npm install
npm run build

# 配置 Nginx
echo ""
echo ">>> 10. 配置 Nginx..."
cat > /etc/nginx/conf.d/yunpingtai.conf <<EOF
server {
    listen 80;
    server_name _;

    location / {
        root ${PROJECT_DIR}/frontend/build;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
    }

    location /static/ {
        alias ${PROJECT_DIR}/backend/staticfiles/;
    }
}
EOF

rm -f /etc/nginx/conf.d/default.conf

# 配置 Systemd
echo ""
echo ">>> 11. 配置 Systemd..."

cat > /etc/systemd/system/gunicorn.service <<EOF
[Unit]
Description=Gunicorn
After=network.target postgresql.service

[Service]
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

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/celery.service <<EOF
[Unit]
Description=Celery Worker
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

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/celerybeat.service <<EOF
[Unit]
Description=Celery Beat
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

# 启动服务
echo ""
echo ">>> 12. 启动服务..."
systemctl daemon-reload
systemctl enable gunicorn celery celerybeat nginx
systemctl restart gunicorn celery celerybeat nginx

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "创建管理员:"
echo "cd ${PROJECT_DIR}/backend"
echo "source venv/bin/activate"
echo "python manage.py createsuperuser"
echo ""
