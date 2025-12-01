#!/bin/bash
# 从本地上传并部署
# 在本地 Mac 运行

PROJECT_DIR="/Users/hanli/Downloads/Yunpingtai"
SERVER_IP="192.168.101.188"
SERVER_USER="root"

echo "=========================================="
echo "打包并上传项目到服务器"
echo "=========================================="

cd ${PROJECT_DIR}

# 1. 打包整个项目
echo ""
echo ">>> 1. 打包项目..."
tar --exclude='node_modules' \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='*.pyc' \
    --exclude='frontend/build' \
    -czf yunpingtai.tar.gz frontend/ backend/ README.md

echo "项目已打包: yunpingtai.tar.gz ($(du -h yunpingtai.tar.gz | cut -f1))"

# 2. 上传到服务器
echo ""
echo ">>> 2. 上传到服务器..."
scp yunpingtai.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
scp deploy_kylin_offline.sh ${SERVER_USER}@${SERVER_IP}:/tmp/

echo ""
echo "=========================================="
echo "上传完成！"
echo "=========================================="
echo ""
echo "下一步在服务器上运行："
echo "ssh ${SERVER_USER}@${SERVER_IP}"
echo "cd /tmp"
echo "chmod +x deploy_kylin_offline.sh"
echo "./deploy_kylin_offline.sh"
echo ""
