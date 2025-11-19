@echo off
chcp 65001 >nul
echo ==========================================
echo 云平台管理系统 - Docker 一键启动
echo ==========================================
echo.

REM 检查Docker是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未检测到Docker，请先安装Docker Desktop
    echo 下载地址: https://www.docker.com/get-started
    pause
    exit /b 1
)

REM 检查Docker是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo 错误: Docker未运行，请启动Docker Desktop
    pause
    exit /b 1
)

echo √ Docker已就绪
echo.

REM 检查docker-compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未检测到docker-compose
    echo 请安装docker-compose或使用Docker Desktop
    pause
    exit /b 1
)

echo √ docker-compose已就绪
echo.

REM 停止并删除旧容器
echo 正在清理旧容器...
docker-compose down >nul 2>&1

echo.
echo 正在构建和启动服务...
echo 首次运行可能需要几分钟时间下载依赖...
echo.

REM 构建并启动
docker-compose up --build -d

REM 等待服务启动
echo.
echo 等待服务启动...
timeout /t 10 /nobreak >nul

REM 检查服务状态
docker-compose ps | findstr "Up" >nul
if errorlevel 1 (
    echo.
    echo 启动失败，请查看日志：
    docker-compose logs
    pause
    exit /b 1
)

echo.
echo ==========================================
echo √ 启动成功！
echo ==========================================
echo.
echo 访问地址：
echo   前端: http://localhost:3000
echo   后端: http://localhost:8000
echo.
echo 默认账号：
echo   管理员: admin / admin123
echo   租户: tenant / tenant123
echo.
echo 查看日志: docker-compose logs -f
echo 停止服务: docker-compose down
echo ==========================================
echo.
pause