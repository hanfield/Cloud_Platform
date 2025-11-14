# API 文档

## 认证

所有API请求（除登录和注册外）都需要在请求头中包含JWT token：

\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### 用户注册（公开接口）

**POST** \`/api/auth/register/\`

请求体：
\`\`\`json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "securepass123",
  "password_confirm": "securepass123",
  "tenant_id": "租户UUID",
  "phone": "13800138000",
  "department": "IT部门",
  "position": "开发工程师"
}
\`\`\`

响应：
\`\`\`json
{
  "detail": "注册成功，请等待管理员审核",
  "username": "newuser",
  "status": "pending"
}
\`\`\`

注意：
- 注册后用户状态为"待审核"（pending），需要管理员审核通过后才能登录
- 必须选择一个已激活的租户
- 密码至少8个字符

### 登录

**POST** \`/api/auth/login/\`

请求体：
\`\`\`json
{
  "username": "admin",
  "password": "admin123"
}
\`\`\`

响应：
\`\`\`json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user_type": "admin",
  "user_id": "1",
  "username": "admin",
  "email": "admin@example.com",
  "tenant_id": null,
  "tenant_name": null
}
\`\`\`

注意：
- 登录时会返回用户类型（admin/tenant）和租户信息
- 只有状态为"已激活"（active）的用户才能登录
- Token中包含用户类型和租户ID，用于权限控制

### 刷新Token

**POST** \`/api/auth/refresh/\`

请求体：
\`\`\`json
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
\`\`\`

## 用户管理

### 获取用户列表

**GET** \`/api/tenants/users/\`

查询参数：
- \`page\`: 页码
- \`page_size\`: 每页数量
- \`user_type\`: 用户类型 (admin, tenant)
- \`status\`: 状态 (active, pending, suspended, rejected)
- \`search\`: 搜索关键词

响应：
\`\`\`json
{
  "count": 10,
  "results": [
    {
      "id": "uuid",
      "username": "user001",
      "email": "user001@example.com",
      "user_type": "tenant",
      "user_type_display": "租户用户",
      "tenant": "tenant_uuid",
      "tenant_name": "租户名称",
      "status": "active",
      "status_display": "已激活",
      "phone": "13800138000",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
\`\`\`

注意：
- 管理员可以查看所有用户
- 租户用户只能查看同租户的用户

### 创建用户（管理员）

**POST** \`/api/tenants/users/\`

请求体：
\`\`\`json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "securepass123",
  "user_type": "tenant",
  "tenant_id": "tenant_uuid",
  "status": "active",
  "phone": "13800138000",
  "department": "IT部门",
  "position": "开发工程师"
}
\`\`\`

### 更新用户

**PUT** \`/api/tenants/users/{id}/\`

**PATCH** \`/api/tenants/users/{id}/\`

请求体：
\`\`\`json
{
  "email": "newemail@example.com",
  "user_type": "tenant",
  "tenant": "tenant_uuid",
  "status": "active",
  "phone": "13900139000",
  "department": "研发部",
  "position": "高级工程师"
}
\`\`\`

### 删除用户

**DELETE** \`/api/tenants/users/{id}/\`

### 审核通过用户

**POST** \`/api/tenants/users/{id}/approve/\`

响应：
\`\`\`json
{
  "detail": "用户已审核通过"
}
\`\`\`

### 拒绝用户注册

**POST** \`/api/tenants/users/{id}/reject/\`

响应：
\`\`\`json
{
  "detail": "用户注册已拒绝"
}
\`\`\`

### 激活用户

**POST** \`/api/tenants/users/{id}/activate/\`

### 暂停用户

**POST** \`/api/tenants/users/{id}/suspend/\`

### 重置用户密码

**POST** \`/api/tenants/users/{id}/reset_password/\`

请求体：
\`\`\`json
{
  "new_password": "newsecurepass123",
  "new_password_confirm": "newsecurepass123"
}
\`\`\`

### 获取用户统计

**GET** \`/api/tenants/users/statistics/\`

响应：
\`\`\`json
{
  "total_count": 10,
  "admin_count": 2,
  "tenant_count": 8,
  "active_count": 9,
  "pending_count": 1,
  "suspended_count": 0,
  "rejected_count": 0
}
\`\`\`

### 获取当前用户信息

**GET** \`/api/tenants/users/me/\`

响应：
\`\`\`json
{
  "id": "uuid",
  "username": "currentuser",
  "email": "user@example.com",
  "user_type": "tenant",
  "tenant": "tenant_uuid",
  "tenant_name": "租户名称",
  "status": "active",
  "phone": "13800138000",
  "department": "IT部门",
  "position": "工程师"
}
\`\`\`

## 租户管理

### 获取租户列表

**GET** \`/api/tenants/\`

查询参数：
- \`page\`: 页码
- \`page_size\`: 每页数量
- \`status\`: 状态过滤 (active, suspended, terminated, pending)
- \`search\`: 搜索关键词

响应：
\`\`\`json
{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "name": "租户名称",
      "code": "TENANT001",
      "status": "active",
      "level": "ordinary",
      "tenant_type": "virtual",
      "contact_person": "张三",
      "contact_phone": "13800138000",
      "contact_email": "zhangsan@example.com"
    }
  ]
}
\`\`\`

### 创建租户

**POST** \`/api/tenants/\`

请求体：
\`\`\`json
{
  "name": "新租户",
  "code": "NEW001",
  "level": "ordinary",
  "discount_level": "level_a",
  "tenant_type": "virtual",
  "contact_person": "李四",
  "contact_phone": "13900139000",
  "contact_email": "lisi@example.com",
  "address": "北京市朝阳区",
  "start_time": "2025-01-01T00:00:00Z",
  "end_time": "2026-01-01T00:00:00Z",
  "quota_vcpus": 10,
  "quota_memory": 32,
  "quota_disk": 500
}
\`\`\`

### 更新租户

**PUT** \`/api/tenants/{id}/\`

**PATCH** \`/api/tenants/{id}/\`

### 删除租户

**DELETE** \`/api/tenants/{id}/\`

### 获取租户统计

**GET** \`/api/tenants/statistics/\`

响应：
\`\`\`json
{
  "total": 10,
  "active": 8,
  "suspended": 1,
  "terminated": 1,
  "by_level": {
    "superior": 2,
    "important": 3,
    "ordinary": 5
  }
}
\`\`\`

## 合同管理

### 获取合同列表

**GET** \`/api/contracts/\`

### 创建合同

**POST** \`/api/contracts/\`

请求体：
\`\`\`json
{
  "contract_number": "CT2025001",
  "name": "云服务合同",
  "tenant": "tenant_uuid",
  "contract_type": "service",
  "amount": 100000.00,
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "status": "draft"
}
\`\`\`

## 信息系统管理

### 获取信息系统列表

**GET** \`/api/information-systems/\`

### 创建信息系统

**POST** \`/api/information-systems/\`

请求体：
\`\`\`json
{
  "name": "财务管理系统",
  "code": "FMS001",
  "tenant": "tenant_uuid",
  "contract": "contract_uuid",
  "system_type": "application",
  "runtime_mode": "7x24",
  "description": "企业财务管理系统"
}
\`\`\`

### 分配资源

**POST** \`/api/information-systems/{id}/allocate_resources/\`

请求体：
\`\`\`json
{
  "resource_type": "compute",
  "quantity": 2,
  "specifications": {
    "cpu": 4,
    "memory": 8,
    "disk": 100
  }
}
\`\`\`

## 产品管理

### 获取产品列表

**GET** \`/api/products/\`

查询参数：
- \`product_type\`: 产品类型 (compute, storage, network, database, security)
- \`status\`: 状态 (active, inactive, discontinued)

### 创建产品

**POST** \`/api/products/\`

请求体：
\`\`\`json
{
  "name": "标准云服务器",
  "code": "ECS001",
  "product_type": "compute",
  "category": "iaas",
  "subcategory": "vm",
  "base_price": 100.00,
  "billing_unit": "core",
  "billing_period": "monthly",
  "pricing_model": "fixed",
  "cpu_capacity": 1,
  "memory_capacity": 2,
  "storage_capacity": 50
}
\`\`\`

## 服务管理

### 获取服务列表

**GET** \`/api/services/\`

### 创建服务

**POST** \`/api/services/\`

请求体：
\`\`\`json
{
  "name": "7x24运维服务",
  "code": "OPS001",
  "service_type": "operation",
  "base_price": 5000.00,
  "billing_unit": "month",
  "sla_level": "gold"
}
\`\`\`

## 租户门户API

### 获取租户信息

**GET** \`/api/tenants/portal/profile/\`

### 获取信息系统概览

**GET** \`/api/tenants/portal/systems-overview/\`

### 获取订单信息

**GET** \`/api/tenants/portal/orders/\`

响应：
\`\`\`json
{
  "orders": [
    {
      "system_name": "财务管理系统",
      "vm_resources": [
        {
          "name": "web-server-01",
          "ip": "192.168.1.10",
          "runtime": "0:00-23:59",
          "status": "running",
          "cpu": 4,
          "memory": 8,
          "disk": 100
        }
      ],
      "storage": {
        "subscribed_capacity": 1000,
        "used_capacity": 650,
        "available_capacity": 350
      },
      "network": {
        "line_type": "电信专线",
        "bandwidth": 100,
        "start_time": "2025-01-01",
        "status": "active"
      }
    }
  ]
}
\`\`\`

### 控制资源

**POST** \`/api/tenants/portal/control-resource/\`

请求体：
\`\`\`json
{
  "resource_id": "vm-001",
  "resource_type": "vm",
  "action": "start"  // 或 "stop"
}
\`\`\`

### 创建信息系统

**POST** \`/api/tenants/portal/create-system/\`

请求体：
\`\`\`json
{
  "name": "新系统",
  "code": "SYS001",
  "runtime_mode": "7x24",
  "description": "系统描述"
}
\`\`\`

### 获取可订阅产品

**GET** \`/api/tenants/portal/available-products/\`

### 订阅产品

**POST** \`/api/tenants/portal/subscribe-product/\`

请求体：
\`\`\`json
{
  "product_id": "product_uuid",
  "quantity": 2,
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}
\`\`\`

## OpenStack集成

### 获取云资源概览

**GET** \`/api/openstack/cloud-overview/\`

### 获取服务器列表

**GET** \`/api/openstack/servers/\`

### 创建服务器

**POST** \`/api/openstack/servers/\`

### 获取镜像列表

**GET** \`/api/openstack/images/\`

### 获取网络列表

**GET** \`/api/openstack/networks/\`

## 错误响应

所有API错误响应格式：

\`\`\`json
{
  "detail": "错误信息描述"
}
\`\`\`

常见HTTP状态码：
- \`200\`: 成功
- \`201\`: 创建成功
- \`400\`: 请求参数错误
- \`401\`: 未认证
- \`403\`: 无权限
- \`404\`: 资源不存在
- \`500\`: 服务器错误
