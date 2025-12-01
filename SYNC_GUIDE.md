# 代码同步到服务器指南

## 快速开始

### 自动同步(推荐)

```bash
cd /Users/hanli/Downloads/Yunpingtai
./sync_to_server.sh
```

默认会同步到 `root@192.168.100.105:/opt/yunpingtai`

**自定义服务器信息:**
```bash
./sync_to_server.sh <服务器IP> <用户名>
# 例如: ./sync_to_server.sh 192.168.100.105 admin
```

---

## 脚本执行流程

自动同步脚本会按顺序执行以下步骤:

### 1️⃣ 编译前端代码
```bash
cd frontend
npm run build
```
- 将React代码打包成生产环境的静态文件
- 输出到 `frontend/build/` 目录

### 2️⃣ 备份服务器代码
```bash
# 在服务器上创建备份
tar -czf backup_YYYYMMDD_HHMMSS.tar.gz backend/apps frontend/build
```
- 自动创建带时间戳的备份文件
- 包含后端apps和前端build目录

### 3️⃣ 同步后端Python代码
```bash
rsync -avz backend/apps/ root@server:/opt/yunpingtai/backend/apps/
```
- 只同步 `backend/apps/` 目录下的Python文件
- 自动排除:
  - `*.pyc` (Python字节码)
  - `__pycache__/` (缓存目录)
  - `.env` (环境变量,保留服务器配置)
  - 日志文件

### 4️⃣ 同步前端build文件
```bash
rsync -avz --delete frontend/build/ root@server:/opt/yunpingtai/frontend/build/
```
- 同步编译后的静态文件
- `--delete` 删除服务器上多余的旧文件

### 5️⃣ 重启服务
```bash
sudo systemctl restart gunicorn    # 重启后端
sudo systemctl reload nginx        # 重新加载前端配置
```

---

## 手动同步步骤

如果不想使用自动脚本,可以手动同步:

### 步骤1: 编译前端
```bash
cd /Users/hanli/Downloads/Yunpingtai/frontend
npm run build
```

### 步骤2: 同步后端代码
```bash
cd /Users/hanli/Downloads/Yunpingtai

# 同步apps目录
rsync -avz --exclude='*.pyc' --exclude='__pycache__' --exclude='.env' \
  backend/apps/ root@192.168.100.105:/opt/yunpingtai/backend/apps/
```

### 步骤3: 同步前端build
```bash
rsync -avz --delete \
  frontend/build/ root@192.168.100.105:/opt/yunpingtai/frontend/build/
```

### 步骤4: SSH到服务器重启服务
```bash
ssh root@192.168.100.105

# 在服务器上执行:
cd /opt/yunpingtai/backend
sudo systemctl restart gunicorn
sudo systemctl reload nginx

# 检查服务状态
sudo systemctl status gunicorn
sudo systemctl status nginx
```

---

## 本次修改的文件清单

### 前端文件
- ✅ `frontend/src/pages/CloudResources.js` - 添加快捷操作和VM搜索
- ✅ `frontend/src/pages/TenantPortal.js` - 添加快捷操作
- ✅ `frontend/src/components/AdminResourceCreate.js` - 添加可用区选择

### 后端文件  
- ✅ `backend/apps/tenants/user_models.py` - 自动创建干系人信号
- ✅ `backend/apps/tenants/admin_resource_management.py` - 修复TenantUser导入
- ✅ `backend/apps/information_systems/views.py` - 修复TenantUser导入

---

## 验证部署

### 1. 检查服务状态
```bash
ssh root@192.168.100.105

# 查看Gunicorn状态
sudo systemctl status gunicorn

# 查看Nginx状态  
sudo systemctl status nginx

# 查看实时日志
sudo journalctl -u gunicorn -f
```

### 2. 测试功能

**前端功能:**
- [ ] 访问云资源管理页面,检查快捷操作按钮
- [ ] 访问租户门户,检查主页快捷操作
- [ ] 测试管理员创建VM时的可用区选择
- [ ] 测试VM列表搜索功能

**后端功能:**
- [ ] 创建新租户用户
- [ ] 检查该用户是否自动出现在租户的干系人列表中

### 3. 查看错误日志
```bash
# Gunicorn错误日志
sudo journalctl -u gunicorn --since "10 minutes ago"

# Nginx错误日志
sudo tail -f /var/log/nginx/error.log

# Django应用日志
sudo tail -f /opt/yunpingtai/backend/logs/django.log
```

---

## 回滚方案

如果部署后出现问题,可以快速回滚:

```bash
ssh root@192.168.100.105
cd /opt/yunpingtai

# 查看备份文件
ls -lh backup_*.tar.gz

# 回滚到最近的备份
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz

# 重启服务
sudo systemctl restart gunicorn
sudo systemctl reload nginx
```

---

## 注意事项

### ⚠️ 配置文件
- `.env` 文件**不会**被同步,保持服务器原有配置
- 如需修改环境变量,请手动SSH到服务器编辑

### ⚠️ 数据库
- 此次更新**无需**执行数据库迁移
- 干系人自动创建功能使用Django信号,无需迁移

### ⚠️ 静态文件
- 前端build已包含所有静态文件
- Nginx直接提供前端静态文件服务

### ⚠️ 依赖包
- 此次更新**无需**安装新的npm或pip包
- 无需运行 `pip install` 或 `npm install`

---

## 故障排查

### 问题1: rsync命令失败
**症状:** "rsync: command not found"

**解决:**
```bash
# Mac上安装rsync
brew install rsync

# 服务器上安装rsync
ssh root@192.168.100.105
yum install -y rsync  # 或 apt-get install rsync
```

### 问题2: SSH连接失败
**症状:** "Permission denied" 或连接超时

**解决:**
```bash
# 检查SSH密钥
ssh-copy-id root@192.168.100.105

# 或使用密码登录(脚本会提示输入密码)
```

### 问题3: 前端编译失败
**症状:** "npm run build" 报错

**解决:**
```bash
cd /Users/hanli/Downloads/Yunpingtai/frontend

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 再次编译
npm run build
```

### 问题4: 服务重启失败
**症状:** Gunicorn或Nginx无法启动

**解决:**
```bash
ssh root@192.168.100.105

# 查看详细错误
sudo journalctl -u gunicorn -n 50 --no-pager
sudo nginx -t  # 测试Nginx配置

# 检查进程
ps aux | grep gunicorn
ps aux | grep nginx
```

---

## 总结

**推荐方式:** 使用自动同步脚本 `./sync_to_server.sh`

**优点:**
- ✅ 一键完成所有步骤
- ✅ 自动备份,安全可靠
- ✅ 自动重启服务
- ✅ 实时显示进度

**耗时:** 约1-2分钟(取决于网络速度)
