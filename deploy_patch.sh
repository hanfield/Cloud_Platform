#!/bin/bash

# Patch Deployment Script (SCP Version)
# Updates ONLY the code files, preserving configuration and database.
# Uses SCP/Tar instead of Rsync to avoid dependency issues.
# Usage: ./deploy_patch.sh <SERVER_IP>

SERVER_IP=$1

if [ -z "$SERVER_IP" ]; then
    echo "Usage: ./deploy_patch.sh <SERVER_IP>"
    echo "Example: ./deploy_patch.sh 192.168.100.105"
    exit 1
fi

PROJECT_DIR="/opt/yunpingtai"
REMOTE_USER="root"

echo "=========================================="
echo "Starting Patch Deployment to $SERVER_IP"
echo "Target: Update code ONLY (No config changes)"
echo "Method: SCP + Tar (No rsync required)"
echo "=========================================="

# 1. Build Frontend Locally
echo ""
echo ">>> 1. Building Frontend Locally..."
cd frontend
# Install dependencies only if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Frontend build failed!"
    exit 1
fi
cd ..

# 2. Prepare Update Package Locally
echo ""
echo ">>> 2. Packaging Code..."
TEMP_DIR=$(mktemp -d)
mkdir -p $TEMP_DIR/backend
mkdir -p $TEMP_DIR/frontend

# Copy Backend (Excluding config/data)
echo "Copying backend..."
# Use cp -a to copy everything including hidden files
cp -a backend/. $TEMP_DIR/backend/

# Remove sensitive/ignored files from temp dir
echo "Cleaning up package..."
rm -rf $TEMP_DIR/backend/venv
rm -rf $TEMP_DIR/backend/__pycache__
rm -rf $TEMP_DIR/backend/*.pyc
rm -rf $TEMP_DIR/backend/.env
rm -rf $TEMP_DIR/backend/db.sqlite3
rm -rf $TEMP_DIR/backend/staticfiles
rm -rf $TEMP_DIR/backend/media
rm -rf $TEMP_DIR/backend/.git
rm -rf $TEMP_DIR/backend/.DS_Store

# Copy Frontend Build
echo "Copying frontend build..."
cp -r frontend/build $TEMP_DIR/frontend/

# Generate Nginx Config with WebSocket Support
echo "Generating Nginx config..."
cat > $TEMP_DIR/yunpingtai.conf <<EOF
server {
    listen 80;
    server_name _;

    # 允许大文件上传（镜像文件可能很大）
    client_max_body_size 10G;

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

    # OpenStack Glance 代理（用于镜像直接上传）
    location /glance-proxy/ {
        # 代理到 OpenStack Glance API
        proxy_pass http://192.168.100.105:9292/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        # 大文件上传需要较长超时
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 60s;
        # 禁用缓冲，直接流式传输
        proxy_buffering off;
        proxy_request_buffering off;
        # 支持大文件
        client_max_body_size 10G;
    }
}
EOF

# Create Tarball
echo "Creating update archive..."
CURRENT_DIR=$(pwd)
cd $TEMP_DIR
tar -czf update_package.tar.gz backend frontend yunpingtai.conf
cd $CURRENT_DIR

# 3. Upload Package
echo ""
echo ">>> 3. Uploading Package..."
scp $TEMP_DIR/update_package.tar.gz $REMOTE_USER@$SERVER_IP:/tmp/update_package.tar.gz

# 4. Apply Update on Server
echo ""
echo ">>> 4. Applying Update on Server..."
ssh $REMOTE_USER@$SERVER_IP "
    echo 'Extracting update...'
    # Extract to temp location first
    mkdir -p /tmp/yunpingtai_update
    tar -xzf /tmp/update_package.tar.gz -C /tmp/yunpingtai_update
    
    echo 'Syncing Backend...'
    # Copy backend files (overwrite code)
    # We use cp -rf to overwrite existing files.
    # Since we stripped config from source, destination config remains untouched.
    cp -rf /tmp/yunpingtai_update/backend/* $PROJECT_DIR/backend/
    # Also copy hidden files if any (excluding . and ..)
    cp -rf /tmp/yunpingtai_update/backend/.[!.]* $PROJECT_DIR/backend/ 2>/dev/null || true
    
    echo 'Syncing Frontend...'
    # For frontend build, replace the folder to avoid stale files
    rm -rf $PROJECT_DIR/frontend/build
    cp -r /tmp/yunpingtai_update/frontend/build $PROJECT_DIR/frontend/
    
    echo 'Updating Nginx Config...'
    sudo cp /tmp/yunpingtai_update/yunpingtai.conf /etc/nginx/conf.d/yunpingtai.conf
    
    echo 'Cleaning up...'
    rm -rf /tmp/yunpingtai_update
    rm -f /tmp/update_package.tar.gz
    
    echo 'Running Database Migrations...'
    cd $PROJECT_DIR/backend
    source venv/bin/activate
    python3 manage.py makemigrations
    python3 manage.py migrate
    deactivate
    
    echo 'Collecting Static Files...'
    cd $PROJECT_DIR/backend
    source venv/bin/activate
    python3 manage.py collectstatic --noinput
    python3 manage.py collectstatic --noinput
    deactivate
    
    echo 'Merging Frontend Static Files...'
    cp -r $PROJECT_DIR/frontend/build/static/* $PROJECT_DIR/backend/staticfiles/
    
    echo '>>> 重启服务...'
    sudo systemctl restart daphne
    sudo systemctl restart nginx
    sudo systemctl restart celery
    sudo systemctl restart celerybeat
"

# Cleanup Local
rm -rf $TEMP_DIR

echo ""
echo "=========================================="
echo "补丁部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://$SERVER_IP"
echo ""
echo "检查服务状态:"
echo "sudo systemctl status daphne"
echo "sudo systemctl status nginx"
echo "sudo systemctl status celery"
echo "sudo systemctl status celerybeat"
echo ""
