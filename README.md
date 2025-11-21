# 云平台管理系统

一个基于 Django + React 的企业级云平台管理系统，提供租户管理、资源管理、账单管理等完整功能。

## 🚀 项目简介

本系统是一个功能完善的云平台管理系统，支持多租户管理、虚拟机资源管理、OpenStack集成、计费系统等核心功能。系统分为管理员门户和租户用户门户，提供权限隔离和数据安全保障。

## 📋 主要功能

### 管理员门户
- **租户管理**：租户创建、编辑、状态管理、干系人管理
- **用户管理**：用户账号管理、权限分配
- **合同管理**：合同创建、续签、到期提醒
- **产品管理**：产品定义、折扣级别、定价策略
- **服务管理**：云服务定义和配置
- **云资源管理**：虚拟机监控、OpenStack集成
- **账单管理**：租户账单查看、统计分析
- **订单管理**：订单查询和管理
- **系统设置**：系统配置、数据库设置、OpenStack配置
- **系统监控**：实时CPU、内存、磁盘监控，服务状态监控

### 租户用户门户
- **我的系统**：信息系统管理、虚拟机创建和控制
- **产品订阅**：产品浏览和订阅
- **账单管理**：账单查询、在线支付
- **订单管理**：订单查询和跟踪
- **个人信息**：租户信息查看

## 🛠 技术栈

### 后端
- **框架**：Django 4.2
- **API**：Django REST Framework
- **数据库**：MySQL
- **认证**：JWT (djangorestframework-simplejwt)
- **云平台**：OpenStack集成
- **监控**：psutil系统监控

### 前端
- **框架**：React 18
- **UI组件**：Ant Design 5
- **路由**：React Router v6
- **HTTP客户端**：Axios
- **图表**：Recharts
- **日期处理**：Day.js

## 📦 项目结构

```
Yunpingtai/
├── backend/                # Django后端
│   ├── cloud_platform/     # 项目配置
│   ├── apps/              # 应用模块
│   │   ├── tenants/       # 租户管理
│   │   ├── contracts/     # 合同管理
│   │   ├── products/      # 产品管理
│   │   ├── services/      # 服务管理
│   │   ├── information_systems/  # 信息系统管理
│   │   ├── openstack/     # OpenStack集成
│   │   ├── billing/       # 计费系统
│   │   ├── orders/        # 订单管理
│   │   ├── assets/        # 资产管理
│   │   ├── system_settings/  # 系统设置
│   │   └── monitoring/    # 系统监控
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/              # React前端
    ├── public/
    ├── src/
    │   ├── components/    # 通用组件
    │   ├── pages/         # 页面组件
    │   ├── services/      # API服务
    │   ├── hooks/         # 自定义Hooks
    │   ├── utils/         # 工具函数
    │   ├── contexts/      # React Context
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## 🚀 快速开始

### 前置要求
- Python 3.9+
- Node.js 14+
- MySQL 5.7+
- (可选) OpenStack环境

### 后端安装

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置数据库
# 编辑 .env 文件，设置数据库连接信息
cp .env.example .env

# 运行迁移
python manage.py makemigrations
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser

# 启动开发服务器
python manage.py runserver
```

### 前端安装

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

访问 `http://localhost:3000` 查看应用

## 🔧 环境配置

### 后端环境变量 (.env)

```env
# 数据库配置
DB_NAME=cloud_platform
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=3306

# Django配置
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# OpenStack配置 (可选)
OPENSTACK_AUTH_URL=http://your-openstack:5000/v3
OPENSTACK_USERNAME=admin
OPENSTACK_PASSWORD=your_password
OPENSTACK_PROJECT_NAME=admin
OPENSTACK_DOMAIN_NAME=Default
```

## 📝 API文档

系统提供RESTful API，主要端点包括：

- `/api/auth/` - 认证相关
- `/api/tenants/` - 租户管理
- `/api/users/` - 用户管理
- `/api/contracts/` - 合同管理
- `/api/products/` - 产品管理
- `/api/services/` - 服务管理
- `/api/information-systems/` - 信息系统管理
- `/api/billing/` - 账单管理
- `/api/orders/` - 订单管理
- `/api/monitoring/` - 系统监控
- `/api/system/settings/` - 系统设置

## 🎨 系统特性

### 1. 权限管理
- 基于角色的访问控制（RBAC）
- 管理员和租户用户权限隔离
- JWT token认证

### 2. 实时监控
- CPU、内存、磁盘使用率实时监控
- 服务状态监控
- 自动刷新（可配置间隔）

### 3. 动态配置
- 系统名称、版本可动态配置
- 数据库连接可视化配置
- OpenStack集成配置

### 4. 账单系统
- 按月账单生成
- 多种支付状态管理
- 账单统计和分析

### 5. 虚拟机管理
- OpenStack虚拟机资源管理
- 虚拟机状态监控
- 启动/停止控制
- 多数据中心支持

## 🔒 安全说明

- 使用JWT进行身份认证
- 密码使用Django内置加密
- API权限严格控制
- XSS和CSRF防护
- CORS配置

## 📱 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 🤝 开发团队

本项目为企业内部云平台管理系统。

## 📄 许可证

内部使用项目

## 🆘 常见问题

### 1. 数据库连接失败
检查 `.env` 文件中的数据库配置是否正确

### 2. JWT Token过期
重新登录获取新token，或配置更长的token有效期

### 3. OpenStack连接失败
确保OpenStack服务正常运行，网络可达，认证信息正确

### 4. 前端API请求失败
检查后端服务是否启动，CORS配置是否正确

## 📞 支持

如有问题请联系系统管理员。
