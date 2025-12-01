#!/bin/bash

# Manual Deployment Script (No Git Required)
# Usage: ./manual_deploy.sh <SERVER_IP>

SERVER_IP=$1

if [ -z "$SERVER_IP" ]; then
    echo "Usage: ./manual_deploy.sh <SERVER_IP>"
    exit 1
fi

PROJECT_DIR="/opt/yunpingtai"
REMOTE_USER="root"

echo ">>> Starting Manual Deployment to $SERVER_IP..."

# 1. Build Frontend Locally
echo ">>> Building Frontend Locally..."
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "Frontend build failed!"
    exit 1
fi
cd ..

# 2. Backup Remote Server
echo ">>> Backing up Remote Server..."
ssh $REMOTE_USER@$SERVER_IP "tar -czf /root/yunpingtai_backup_$(date +%Y%m%d_%H%M%S).tar.gz $PROJECT_DIR"

# 3. Upload Backend Code
echo ">>> Uploading Backend Code..."
# Exclude venv, __pycache__, .env, db.sqlite3, staticfiles, media
rsync -avz --exclude 'venv' --exclude '__pycache__' --exclude '*.pyc' --exclude '.env' --exclude 'db.sqlite3' --exclude 'staticfiles' --exclude 'media' backend/ $REMOTE_USER@$SERVER_IP:$PROJECT_DIR/backend/

# 4. Upload Frontend Build
echo ">>> Uploading Frontend Build..."
rsync -avz frontend/build/ $REMOTE_USER@$SERVER_IP:$PROJECT_DIR/frontend/build/

# 5. Restart Services
echo ">>> Restarting Services..."
ssh $REMOTE_USER@$SERVER_IP "systemctl restart gunicorn celery celerybeat nginx"

echo ">>> Deployment Complete!"
