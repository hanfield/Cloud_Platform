# 云平台管理系统

一个功能完善的云平台管理系统，支持租户管理、资源管理、合同管理、产品服务管理等功能。

## 项目概述

本系统是一个基于 Django + React 的云平台管理系统，提供管理员和租户两种角色的完整功能支持。

### 主要功能

#### 管理员功能
- **仪表板**: 系统概览、资源统计、运营数据
- **租户管理**:
  - 租户信息管理、资源配额、干系人管理
  - 租户详情查看（基本信息、干系人、信息系统、合同管理）
  - 租户状态管理（激活/暂停/终止）
- **用户管理**: 用户创建、审核、权限管理、密码重置
- **信息系统管理**:
  - 系统创建、资源分配、运行监控
  - 产品和服务关联
  - 虚拟机资源管理
  - 每日计费记录查看
  - 资源调整历史跟踪
- **产品管理**: 产品定义、定价策略、库存管理
- **服务管理**: 服务目录、服务订阅、服务监控
- **资产管理**: 物理资产、虚拟资产管理
- **云资源管理**: OpenStack资源管理
- **自动化任务**:
  - 每日自动计费（凌晨0:10执行）
  - 资源变更检测（每小时执行）
  - 虚拟机状态同步（每5分钟执行）

#### 租户功能
- **用户注册**: 租户用户自助注册（需管理员审核）
- **租户门户**: 租户专属自助服务平台
- **基本信息**: 查看租户信息和干系人
- **信息系统概览**: 查看和创建信息系统
- **订单管理**:
  - 虚拟机资源管理（启动/停止）
  - 存储资源查看
  - 网络资源查看
- **产品订阅**: 查看和订阅产品服务
- **数据隔离**: 只能查看和管理本租户的数据

## 技术栈

### 后端
- **框架**: Django 4.2
- **API**: Django REST Framework
- **认证**: JWT (djangorestframework-simplejwt)
- **数据库**: PostgreSQL 14+
- **任务队列**: Celery 5.3+
- **消息代理**: Redis 7.0+
- **定时任务**: Celery Beat
- **云平台集成**: OpenStack SDK

### 前端
- **框架**: React 18
- **UI组件**: Ant Design 5
- **路由**: React Router 6
- **HTTP客户端**: Axios
- **图表**: Recharts

## 快速开始

### 方式一：Docker 一键启动（推荐）

**最简单的方式，无需安装Python和Node.js**

#### 前提条件
- 安装 [Docker Desktop](https://www.docker.com/get-started)

#### 启动步骤

**Windows用户**：双击运行 \`start.bat\`

**macOS/Linux用户**：
\`\`\`bash
./start.sh
\`\`\`

**或手动启动**：
\`\`\`bash
docker-compose up --build -d
\`\`\`

访问 http://localhost:3000 即可使用系统。

详细说明请查看 [DOCKER_GUIDE.md](./DOCKER_GUIDE.md)

---

### 方式二：本地开发环境

#### 环境要求

- Python 3.9+
- Node.js 16+
- npm 或 yarn
- PostgreSQL 14+
- Redis 7.0+ (用于Celery任务队列)

#### Redis 安装

**macOS (使用 Homebrew)**:
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

**Windows**:
- 下载 [Redis for Windows](https://github.com/microsoftarchive/redis/releases)
- 或使用 WSL (Windows Subsystem for Linux)

#### PostgreSQL 安装

**macOS (使用 Homebrew)**:
```bash
brew install postgresql@14
brew services start postgresql@14
createdb cloud_platform
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql-14
sudo systemctl start postgresql
sudo -u postgres createdb cloud_platform
```

**Windows**:
1. 从 [PostgreSQL官网](https://www.postgresql.org/download/windows/) 下载安装程序
2. 安装后，使用 pgAdmin 或命令行创建数据库 `cloud_platform`

#### 配置数据库

创建 `backend/.env` 文件并配置数据库连接：
```
DB_NAME=cloud_platform
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
```

#### 后端安装

\`\`\`bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv .venv

# 激活虚拟环境
# macOS/Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 运行数据库迁移
python manage.py migrate

# 初始化默认数据（管理员账号和测试租户）
python init_data.py

# 启动开发服务器
python manage.py runserver
\`\`\`

后端服务将运行在 http://127.0.0.1:8000/

### 前端安装

\`\`\`bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
\`\`\`

前端服务将运行在 http://localhost:3000/

## 初始化数据

首次部署时，需要运行初始化脚本创建默认账号：

\`\`\`bash
cd backend
python init_data.py
\`\`\`

该脚本会自动创建：
- 管理员账号（admin/admin123）
- 测试租户（测试租户公司）
- 测试租户用户（tenant/tenant123）

**注意**：如果账号已存在，脚本会跳过创建，不会覆盖现有数据。

详细的安装部署指南请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 用户系统

### 用户类型

系统支持两种用户类型：

1. **管理员用户**
   - 可以管理所有租户和用户
   - 审核用户注册申请
   - 查看所有数据
   - 系统配置权限

2. **租户用户**
   - 需要关联到具体租户
   - 只能查看和管理本租户的数据
   - 可以自助注册（需管理员审核）

### 用户注册流程

1. 访问注册页面 `/register`
2. 填写用户信息并选择所属租户
3. 提交注册申请（状态：待审核）
4. 管理员在用户管理页面审核
5. 审核通过后用户可以登录

### 默认账号

#### 管理员账号
- 用户名: \`admin\`
- 密码: \`admin123\`
- 类型: 管理员

#### 租户测试账号
- 用户名: \`tenant\`
- 密码: \`tenant123\`
- 类型: 租户用户

## 主要API端点

### 认证相关
- \`POST /api/auth/register/\` - 用户注册（公开）
- \`POST /api/auth/login/\` - 用户登录
- \`POST /api/auth/refresh/\` - 刷新Token

### 管理功能
- \`/api/tenants/\` - 租户管理
- \`/api/tenants/users/\` - 用户管理
- \`/api/contracts/\` - 合同管理
- \`/api/information-systems/\` - 信息系统管理
- \`/api/products/\` - 产品管理
- \`/api/services/\` - 服务管理
- \`/api/assets/\` - 资产管理
- \`/api/openstack/\` - OpenStack资源管理

### 租户门户
- \`/api/tenants/portal/\` - 租户门户API

### 信息系统详细信息
- \`GET /api/information-systems/{id}/detailed_info/\` - 获取系统完整信息
  - 基本信息
  - 关联的产品和服务
  - 虚拟机列表（按数据中心分组）
  - 每日计费记录（最近30天）
  - 资源调整历史（最近10条）
  - 月度成本统计

详细API文档请查看 [API.md](./API.md)

## Celery定时任务

系统使用Celery实现自动化定时任务，需要Redis作为消息代理。

### 启动Celery服务

**确保Redis已启动**：
\`\`\`bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis
\`\`\`

**启动Celery Worker（执行任务）**：
\`\`\`bash
cd backend
celery -A cloud_platform worker -l info
\`\`\`

**启动Celery Beat（定时调度）**：
\`\`\`bash
# 在新的终端窗口中
cd backend
celery -A cloud_platform beat -l info
\`\`\`

**（可选）启动Flower监控面板**：
\`\`\`bash
pip install flower
celery -A cloud_platform flower
# 访问 http://localhost:5555
\`\`\`

### 定时任务说明

| 任务名称 | 执行时间 | 功能说明 |
|---------|---------|---------|
| 每日计费 | 每天凌晨0:10 | 自动为所有信息系统生成前一天的计费记录 |
| 资源变更检测 | 每小时整点 | 检测虚拟机资源配置变化并记录 |
| 虚拟机状态同步 | 每5分钟 | 同步虚拟机运行状态 |

### 计费规则

- **CPU**: 0.1元/核/小时
- **内存**: 0.05元/GB/小时
- **存储**: 0.01元/GB/小时
- **运行时间**:
  - 7x24模式: 24小时/天
  - 5x8模式: 8小时/天
- **折扣**: 自动应用租户的discount_rate

详细使用说明请查看 [CELERY_GUIDE.md](./backend/CELERY_GUIDE.md)

## 测试

### 运行后端测试

\`\`\`bash
cd backend
python test_crud.py
\`\`\`

## 权限控制

系统实现了基于用户类型和租户的权限控制：

- **管理员**: 可以访问所有功能和数据
- **租户用户**: 只能访问本租户的数据
- **数据隔离**: 租户用户在查询时自动过滤，只显示本租户数据
- **JWT Token**: Token中包含用户类型和租户ID，用于权限验证

## 更新日志

### v1.2.0 (最新)
- ✅ **Celery定时任务系统**
  - 每日自动计费任务（凌晨0:10执行）
  - 资源变更检测（每小时执行）
  - 虚拟机状态同步（每5分钟执行）
  - Redis消息队列集成
- ✅ **信息系统增强**
  - 产品和服务关联（ManyToManyField）
  - 详细信息API端点（detailed_info）
  - 每日计费记录模型和查询
  - 资源调整历史跟踪
  - 月度成本统计
- ✅ **计费系统**
  - 自动化每日计费记录生成
  - 灵活的定价模型（CPU/内存/存储）
  - 租户折扣率自动应用
  - 7x24和5x8运行模式支持
- ✅ **管理员门户优化**
  - 租户管理界面整合
  - 合同管理集成到租户详情
  - 信息系统展示在租户详情中
  - 侧边栏菜单简化（7个核心模块）

### v1.1.0
- ✅ 用户管理系统
  - 用户注册功能（租户自助注册）
  - 用户审核流程（待审核/已激活/已拒绝/已暂停）
  - 用户CRUD管理
  - 密码重置功能
- ✅ 用户与租户关联
  - UserProfile模型扩展
  - 用户类型管理（管理员/租户用户）
  - 租户数据隔离
- ✅ 增强的JWT认证
  - Token中包含用户类型和租户信息
  - 登录时验证用户状态
  - 基于角色的权限控制

### v1.0.0
- ✅ 完整的租户管理功能
- ✅ 管理员和租户双角色支持
- ✅ 租户自助服务门户
- ✅ 资源管理和监控
- ✅ 合同和订单管理
- ✅ 产品和服务管理
- ✅ OpenStack集成
- ✅ JWT认证系统
- ✅ 操作日志记录
