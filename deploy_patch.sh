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

# Create Tarball
echo "Creating update archive..."
CURRENT_DIR=$(pwd)
cd $TEMP_DIR
tar -czf update_package.tar.gz backend frontend
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
    
    echo 'Cleaning up...'
    rm -rf /tmp/yunpingtai_update
    rm -f /tmp/update_package.tar.gz
    
    echo 'Restarting Services...'
    systemctl restart gunicorn celery celerybeat
"

# Cleanup Local
rm -rf $TEMP_DIR

echo ""
echo "=========================================="
echo "Patch Complete!"
echo "=========================================="
