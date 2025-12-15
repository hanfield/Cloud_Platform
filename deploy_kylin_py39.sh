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

# 尝试安装 PostgreSQL 13
if ! rpm -q postgresql13-server &> /dev/null && ! rpm -q postgresql-server &> /dev/null; then
    echo "安装 PostgreSQL 13..."
    yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm || true
    dnf -qy module disable postgresql 2>/dev/null || true
    
    if yum install -y postgresql13-server postgresql13-contrib; then
        PG_VERSION=13
        PG_SETUP="/usr/pgsql-13/bin/postgresql-13-setup"
        PG_SERVICE="postgresql-13"
        PG_DATA="/var/lib/pgsql/13/data"
        
        ln -sf /usr/pgsql-13/bin/psql /usr/bin/psql
    else
        echo "PostgreSQL 13 安装失败，尝试安装默认版本..."
        yum install -y postgresql-server postgresql-contrib
        PG_VERSION="default"
        PG_SETUP="postgresql-setup"
        PG_SERVICE="postgresql"
        PG_DATA="/var/lib/pgsql/data"
    fi
else
    if rpm -q postgresql13-server &> /dev/null; then
        PG_VERSION=13
        PG_SETUP="/usr/pgsql-13/bin/postgresql-13-setup"
        PG_SERVICE="postgresql-13"
        PG_DATA="/var/lib/pgsql/13/data"
    else
        PG_VERSION="default"
        PG_SETUP="postgresql-setup"
        PG_SERVICE="postgresql"
        PG_DATA="/var/lib/pgsql/data"
    fi
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

# 创建数据库
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# 配置 pg_hba.conf
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
pip install daphne==4.0.0
pip install channels==4.0.0
pip install channels-redis==4.1.0
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

    # WebSocket support
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
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

cat > /etc/systemd/system/daphne.service <<EOF
[Unit]
Description=Daphne ASGI Server (WebSocket Support)
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${PROJECT_DIR}/backend
Environment="PATH=${PROJECT_DIR}/backend/venv/bin"
Environment="DJANGO_SETTINGS_MODULE=cloud_platform.settings"
ExecStart=${PROJECT_DIR}/backend/venv/bin/daphne \\
    -b 0.0.0.0 \\
    -p 8000 \\
    --access-log /var/log/daphne_access.log \\
    cloud_platform.asgi:application

Restart=always
RestartSec=10

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
systemctl enable daphne celery celerybeat nginx
systemctl restart daphne celery celerybeat nginx

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
