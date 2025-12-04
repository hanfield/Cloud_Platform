#!/bin/bash
set -e

# 配置
DB_NAME="cloud_platform"
BACKUP_DIR="/root/pg_backup_$(date +%Y%m%d_%H%M%S)"
PG_OLD_SERVICE="postgresql"
PG_NEW_SERVICE="postgresql-13"

echo "=========================================="
echo "开始 PostgreSQL 升级流程 (目标: v13)"
echo "=========================================="

# 1. 检查当前版本
echo ">>> 1. 检查当前 PostgreSQL 版本..."
if command -v psql &> /dev/null; then
    CURRENT_VER=$(psql --version | awk '{print $3}' | cut -d. -f1)
    echo "当前版本: $CURRENT_VER"
    if [ "$CURRENT_VER" -ge "13" ]; then
        echo "当前版本已经是 13 或更高，无需升级。"
        exit 0
    fi
else
    echo "未检测到 PostgreSQL，将执行全新安装。"
fi

# 2. 备份数据
echo ""
echo ">>> 2. 备份现有数据..."
mkdir -p $BACKUP_DIR
echo "备份目录: $BACKUP_DIR"

if systemctl is-active --quiet $PG_OLD_SERVICE; then
    echo "正在导出数据库..."
    # 尝试备份所有数据库
    if sudo -u postgres pg_dumpall > "$BACKUP_DIR/all_databases.sql"; then
        echo "✅ 数据库备份成功"
    else
        echo "❌ 数据库备份失败！停止升级以保护数据。"
        exit 1
    fi
    
    # 停止旧服务
    echo "停止旧 PostgreSQL 服务..."
    systemctl stop $PG_OLD_SERVICE
    systemctl disable $PG_OLD_SERVICE
else
    echo "PostgreSQL 服务未运行，跳过在线备份（请确保您有数据备份）"
fi

# 3. 安装 PostgreSQL 13
echo ""
echo ">>> 3. 安装 PostgreSQL 13..."
# 安装官方源
yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm || true
dnf -qy module disable postgresql 2>/dev/null || true

# 安装新版本
yum install -y postgresql13-server postgresql13-contrib

# 4. 初始化新数据库
echo ""
echo ">>> 4. 初始化 PostgreSQL 13..."
/usr/pgsql-13/bin/postgresql-13-setup initdb

# 配置 pg_hba.conf (允许本地密码连接)
PG_HBA="/var/lib/pgsql/13/data/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
    echo "配置认证方式..."
    # 备份原配置
    cp $PG_HBA "$PG_HBA.bak"
    # 添加 md5 认证
    sed -i "s/ident/md5/g" $PG_HBA
    sed -i "s/peer/md5/g" $PG_HBA
    echo "host    all             all             127.0.0.1/32            md5" >> $PG_HBA
fi

# 5. 启动新服务
echo ""
echo ">>> 5. 启动新服务..."
systemctl enable $PG_NEW_SERVICE
systemctl start $PG_NEW_SERVICE

# 创建软链接
ln -sf /usr/pgsql-13/bin/psql /usr/bin/psql
ln -sf /usr/pgsql-13/bin/pg_dump /usr/bin/pg_dump
ln -sf /usr/pgsql-13/bin/pg_restore /usr/bin/pg_restore

# 6. 恢复数据
echo ""
echo ">>> 6. 恢复数据..."
if [ -f "$BACKUP_DIR/all_databases.sql" ]; then
    echo "正在导入数据..."
    if sudo -u postgres psql -f "$BACKUP_DIR/all_databases.sql" postgres; then
        echo "✅ 数据恢复成功"
    else
        echo "⚠️ 数据恢复过程中出现警告或错误，请检查日志。"
        echo "备份文件位于: $BACKUP_DIR/all_databases.sql"
    fi
else
    echo "未找到备份文件，跳过恢复。"
fi

# 7. 验证
echo ""
echo ">>> 7. 验证升级..."
NEW_VER=$(psql --version)
echo "新版本: $NEW_VER"

echo ""
echo "=========================================="
echo "升级完成！"
echo "请检查应用程序是否能正常连接数据库。"
echo "备份文件保留在: $BACKUP_DIR"
echo "=========================================="
