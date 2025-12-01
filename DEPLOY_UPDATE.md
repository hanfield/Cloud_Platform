# 部署更新指南

本指南介绍如何将最近的更改（管理员资源管理和运行时间统计）部署到服务器。

## 1. 提交代码

首先，确保所有本地更改都已提交并推送到 Git 仓库。

```bash
# 在本地终端执行
git add .
git commit -m "Implement admin resource management and runtime statistics"
git push origin main
```

## 2. 更新服务器代码

登录到您的服务器并拉取最新代码。

```bash
# 登录服务器
ssh root@<您的服务器IP>

# 进入项目目录
cd /opt/yunpingtai

# 拉取最新代码
git pull
```

## 3. 重启后端服务

由于修改了 Python 代码（views.py, serializers.py 等），需要重启后端服务。
*注意：本次更新没有引入新的 Python 依赖，也没有修改数据库模型，因此不需要运行 pip install 或 migrate。*

```bash
# 重启 Gunicorn 和 Celery
systemctl restart gunicorn celery celerybeat
```

## 4. 重新构建前端

由于修改了 React 组件（Dashboard.js, TenantPortal.js 等），需要重新构建前端资源。

```bash
# 进入前端目录
cd frontend

# 安装依赖（可选，确保环境一致）
npm install

# 构建生产环境代码
npm run build

# 返回根目录
cd ..
```

## 5. 验证部署

1.  访问您的云平台地址。
2.  **管理员验证**：
    *   登录管理员账号。
    *   在仪表板（Dashboard）检查是否有"为租户建系统"和"为租户建VM"的快捷按钮。
    *   尝试点击按钮，确认模态框正常弹出。
3.  **租户验证**：
    *   登录租户账号。
    *   进入"我的信息系统"或"云资源"页面。
    *   检查表格中是否显示"运行时长"列，并显示格式化的时间（如"2天5小时"）。

## 故障排除

*   **看不到前端变化**：尝试清除浏览器缓存或强制刷新（Ctrl+F5）。
*   **后端报错**：查看日志 `journalctl -u gunicorn -f`。
