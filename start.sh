#!/bin/bash

echo "=========================================="
echo "云平台管理系统 - Docker 一键启动"
echo "=========================================="
echo ""

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: 未检测到Docker，请先安装Docker"
    echo "下载地址: https://www.docker.com/get-started"
    exit 1
fi

# 检查Docker是否运行
if ! docker info &> /dev/null; then
    echo "错误: Docker未运行，请启动Docker Desktop"
    exit 1
fi

echo "✓ Docker已就绪"
echo ""

# 检查docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "错误: 未检测到docker-compose"
    echo "请安装docker-compose或使用Docker Desktop"
    exit 1
fi

echo "✓ docker-compose已就绪"
echo ""

# 停止并删除旧容器
echo "正在清理旧容器..."
docker-compose down 2>/dev/null

echo ""
echo "正在构建和启动服务..."
echo "首次运行可能需要几分钟时间下载依赖..."
echo ""

# 构建并启动
docker-compose up --build -d

# 等待服务启动
echo ""
echo "等待服务启动..."
sleep 10

# 检查服务状态
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "=========================================="
    echo "✓ 启动成功！"
    echo "=========================================="
    echo ""
    echo "访问地址："
    echo "  前端: http://localhost:3000"
    echo "  后端: http://localhost:8000"
    echo ""
    echo "默认账号："
    echo "  管理员: admin / admin123"
    echo "  租户: tenant / tenant123"
    echo ""
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
    echo "=========================================="
else
    echo ""
    echo "启动失败，请查看日志："
    docker-compose logs
    exit 1
fi