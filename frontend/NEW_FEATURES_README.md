# 新功能说明文档

## 新增功能概述

本项目已成功添加了以下两个核心功能模块：

1. **信息系统管理** - 管理和监控信息系统的运行状态和资源使用情况
2. **产品管理** - 管理云平台产品、定价策略和客户折扣级别

## 功能详细说明

### 1. 信息系统管理

#### 主要功能
- **系统基本信息展示**: 展示信息系统的基本信息、资源总量、产品内容、服务内容
- **运行状态管理**: 支持7x24小时和5x8小时两种运行模式
- **状态控制**: 启动、停止、维护信息系统
- **费用管理**: 展示当月应收费用、运行时间统计
- **资源详情**: 展示每套信息系统的详细资源情况

#### 资源详情包含字段
- **区域**: 数据中心可用区
- **名称**: 资源名称
- **IP**: IP地址
- **CPU**: CPU核数
- **内存**: 内存大小(GB)
- **存储**: 存储容量(GB)
- **开启时间**: 最新启动时间
- **运行时间**: 持续运行时长
- **开关状态**: 运行状态

#### 页面结构
- **系统总览**: 展示所有信息系统列表和基本信息
- **资源详情**: 展示详细的资源分布和使用情况

### 2. 产品管理

#### 主要功能
- **产品管理**: 创建、编辑、删除云平台产品
- **定价策略**: 基于容量、类型、数量等不同方面进行基础定价
- **折扣管理**: 管理不同客户类型可享受的折扣级别
- **租户订阅**: 便于统计和查看租户的订阅产品

#### 产品定价维度
- **容量定价**: 基于CPU、内存、存储容量定价
- **类型定价**: 不同类型产品采用不同定价策略
- **数量定价**: 支持阶梯定价和批量折扣
- **订阅模式**: 支持按小时、天、月、年计费

#### 折扣级别管理
- **客户类型关联**: 与租户类型关联，不同类型客户享受不同折扣
- **消费门槛**: 支持设置最小/最大消费金额限制
- **状态管理**: 启用/停用折扣级别

## 技术实现

### 新增组件

#### 服务层
- `informationSystemService.js` - 信息系统管理API服务
- `productService.js` - 产品管理API服务

#### 页面组件
- `InformationSystemManagement.js` - 信息系统管理主页面
- `ProductManagement.js` - 产品管理主页面

#### 业务组件
- `InformationSystemTable.js` - 信息系统表格组件
- `InformationSystemForm.js` - 信息系统表单组件
- `InformationSystemResources.js` - 信息系统资源详情组件
- `ProductTable.js` - 产品表格组件
- `ProductForm.js` - 产品表单组件
- `DiscountLevelManagement.js` - 折扣级别管理组件

### 数据结构

#### 信息系统 (InformationSystem)
```javascript
{
  id: number,
  name: string,           // 系统名称
  code: string,           // 系统编码
  system_type: string,    // 系统类型
  operation_mode: string, // 运行模式 (7x24, 5x8)
  status: string,         // 状态 (running, stopped, maintenance)
  total_cpu: number,      // CPU总量
  total_memory: number,   // 内存总量
  total_storage: number,  // 存储总量
  tenant: object,         // 所属租户
  description: string,    // 描述
  service_content: string, // 服务内容
  product_content: string  // 产品内容
}
```

#### 产品 (Product)
```javascript
{
  id: number,
  name: string,           // 产品名称
  code: string,           // 产品编码
  product_type: string,   // 产品类型
  status: string,         // 状态 (active, inactive)
  base_price: number,     // 基础价格
  billing_unit: string,   // 计费单位
  billing_period: string, // 计费周期
  pricing_model: string,  // 定价模型
  min_quantity: number,   // 最小购买量
  cpu_capacity: number,   // CPU容量
  memory_capacity: number, // 内存容量
  storage_capacity: number, // 存储容量
  description: string,    // 描述
  features: string        // 产品特性
}
```

#### 折扣级别 (DiscountLevel)
```javascript
{
  id: number,
  name: string,           // 折扣级别名称
  code: string,           // 折扣级别编码
  discount_rate: number,  // 折扣率 (0-1)
  customer_type: string,  // 客户类型
  status: string,         // 状态 (active, inactive)
  min_amount: number,     // 最小消费金额
  max_amount: number,     // 最大消费金额
  description: string     // 描述
}
```

## 使用说明

### 启动应用
```bash
cd frontend
npm start
```

### 访问新功能
1. **信息系统管理**: 点击侧边栏 "信息系统管理" 菜单
2. **产品管理**: 点击侧边栏 "产品管理" 菜单

### 主要操作流程

#### 信息系统管理
1. 查看系统总览和统计信息
2. 创建新的信息系统
3. 查看系统详细信息和资源分布
4. 控制系统运行状态（启动/停止/维护）
5. 查看费用信息和运行时间统计

#### 产品管理
1. 查看产品列表和统计信息
2. 创建新的产品
3. 配置产品定价策略
4. 管理折扣级别
5. 查看租户订阅情况

## 测试数据

项目包含测试脚本 `test-new-features.js`，可用于验证新功能：

```bash
node src/test-new-features.js
```

## 后续扩展建议

1. **API集成**: 连接后端API实现数据持久化
2. **权限控制**: 添加基于角色的访问控制
3. **报表导出**: 增强数据导出功能
4. **监控集成**: 集成系统监控和告警功能
5. **计费引擎**: 实现完整的计费和账单功能

## 注意事项

- 当前版本使用模拟数据，实际部署时需要连接后端API
- 所有表单都包含完整的验证规则
- 组件支持响应式设计，适配不同屏幕尺寸
- 支持中文本地化，符合国内用户使用习惯