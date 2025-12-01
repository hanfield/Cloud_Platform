#!/bin/bash

# 配置
SOURCE_DIR="/Users/hanli/Downloads/Yunpingtai"
DEST_DIR="/Users/hanli/Downloads/svn_checkout"
SVN_USERNAME="lihan"
SVN_PASSWORD="Abcd@2025"

# 检查目录是否存在
if [ ! -d "$DEST_DIR" ]; then
    echo "错误: SVN目录不存在: $DEST_DIR"
    exit 1
fi

echo "=========================================="
echo "正在同步代码到 SVN 目录..."
echo "源目录: $SOURCE_DIR"
echo "目标目录: $DEST_DIR"
echo "=========================================="

# 1. 使用 rsync 同步文件 (排除不需要的文件)
# --delete 会删除目标目录中源目录没有的文件
rsync -av --delete \
    --exclude='.git' \
    --exclude='.idea' \
    --exclude='.venv' \
    --exclude='venv' \
    --exclude='frontend/node_modules' \
    --exclude='**/__pycache__' \
    --exclude='**/*.pyc' \
    --exclude='.DS_Store' \
    --exclude='*.tar.gz' \
    --exclude='sync_to_svn.sh' \
    "$SOURCE_DIR/" "$DEST_DIR/"

echo "------------------------------------------"
echo "文件同步完成，正在处理 SVN 变更..."
echo "------------------------------------------"

# 2. 进入 SVN 目录
cd "$DEST_DIR" || exit

# 3. 添加新文件 (svn add)
svn add --force . > /dev/null 2>&1

# 4. 处理删除的文件 (svn delete)
# 查找状态为 '!' (丢失) 的文件并执行 svn delete
svn status | grep '^\!' | sed 's/! *//' | while read -r file; do
    svn delete "$file"
done

# 5. 显示状态
echo "变更状态:"
svn status

echo "------------------------------------------"

# 6. 提交确认
read -p "请输入提交信息 (直接回车取消提交): " COMMIT_MSG

if [ -n "$COMMIT_MSG" ]; then
    echo "正在提交到 SVN..."
    svn commit -m "$COMMIT_MSG" --username "$SVN_USERNAME" --password "$SVN_PASSWORD" --non-interactive
    echo "提交完成！"
else
    echo "已取消提交。"
fi
