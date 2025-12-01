#!/bin/bash
# 本地编译前端并打包上传
# 在 Mac 本地运行

set -e

PROJECT_DIR="/Users/hanli/Downloads/Yunpingtai"
SERVER_IP="192.168.101.188"
SERVER_USER="root"

echo "=========================================="
echo "编译前端并准备上传"
echo "=========================================="

# 1. 编译前端
echo ""
echo ">>> 1. 编译 React 前端..."
cd ${PROJECT_DIR}/frontend
npm install
npm run build

# 2. 打包 build 目录
echo ""
echo ">>> 2. 打包编译结果..."
cd ${PROJECT_DIR}/frontend
tar -czf frontend-build.tar.gz build/
echo "前端已打包到: ${PROJECT_DIR}/frontend/frontend-build.tar.gz"

# 3. 打包后端代码
echo ""
echo ">>> 3. 打包后端代码..."
cd ${PROJECT_DIR}
tar -czf backend.tar.gz backend/
echo "后端已打包到: ${PROJECT_DIR}/backend.tar.gz"

# 4. 上传到服务器
echo ""
echo ">>> 4. 上传文件到服务器..."
scp ${PROJECT_DIR}/frontend/frontend-build.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
scp ${PROJECT_DIR}/backend.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
scp ${PROJECT_DIR}/deploy.sh ${SERVER_USER}@${SERVER_IP}:/tmp/

echo ""
echo "=========================================="
echo "上传完成！"
echo "=========================================="
echo ""
echo "下一步在服务器上运行："
echo "ssh ${SERVER_USER}@${SERVER_IP}"
echo "cd /tmp"
echo "chmod +x deploy_kylin_prebuilt.sh"
echo "./deploy_kylin_prebuilt.sh"
echo ""
