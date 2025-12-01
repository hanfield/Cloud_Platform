# 手动部署指南 (无 Git 环境)

由于您的服务器无法连接 GitHub，且您担心服务器上存在未同步的更改，我们建议采用以下"安全同步"流程。

## 1. 确认差异 (可选但推荐)

如果您担心服务器上有"昨天做的更改"被覆盖，请先将服务器代码下载到本地进行对比。

```bash
# 1. 创建临时目录
mkdir -p /tmp/server_code

# 2. 下载服务器代码 (排除大文件)
scp -r root@<服务器IP>:/opt/yunpingtai/backend /tmp/server_code/

# 3. 使用对比工具 (如 VS Code) 对比
# 在 VS Code 中打开 /tmp/server_code/backend 和本地 backend 文件夹进行比较
```

如果发现服务器上有本地没有的代码，请手动将其合并到本地代码中。

## 2. 执行手动部署

确认本地代码是最新的之后，使用我们提供的 `manual_deploy.sh` 脚本进行部署。该脚本会：
1.  在本地构建前端 (生成 `build` 文件夹)。
2.  自动备份服务器上的现有代码。
3.  使用 `rsync` 将本地代码同步到服务器 (排除配置文件和数据库)。
4.  重启服务。

### 使用方法：

```bash
# 在项目根目录下执行
./manual_deploy.sh <服务器IP>

# 例如
./manual_deploy.sh 192.168.1.100
```

### 脚本说明

*   **前端**：脚本会在本地运行 `npm run build`，然后直接上传构建好的静态文件。这意味着服务器不需要运行 `npm install` 或连接 GitHub。
*   **后端**：脚本会同步 `backend` 目录下的 Python 代码，但会**保留**服务器上的 `.env` (配置文件)、`db.sqlite3` (数据库) 和 `media` (上传文件)。
*   **备份**：脚本会在服务器 `/root` 目录下创建一个 `.tar.gz` 备份包，如果部署出问题，您可以随时恢复。

## 3. 故障恢复

如果部署后出现问题，可以通过以下命令恢复备份：

```bash
ssh root@<服务器IP>

# 解压备份覆盖回去
cd /
tar -xzf /root/yunpingtai_backup_xxxx.tar.gz
systemctl restart gunicorn celery celerybeat nginx
```
