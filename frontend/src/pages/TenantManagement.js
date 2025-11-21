/**
 * 租户管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Input, Select, Space, message, Row, Col, Card, Statistic, Tabs, Table, Tag } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  TeamOutlined,
  ExportOutlined,
  UserOutlined,
  DesktopOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  PayCircleOutlined
} from '@ant-design/icons';
import TenantTable from '../components/TenantTable';
import TenantForm from '../components/TenantForm';
import tenantService from '../services/tenantService';
import contractService from '../services/contractService';
import informationSystemService from '../services/informationSystemService';
import { exportToCSV, formatDate, getStatusText, getStatusColor } from '../utils/helpers';
import AdminBillingView from './AdminBillingView';
import OrderManagement from './OrderManagement';

const { Search } = Input;
const { Option } = Select;

// 信息系统详细信息展开组件
const SystemDetailExpanded = ({ record }) => {
  const [detailedInfo, setDetailedInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        console.log('正在获取系统详细信息，系统ID:', record.id);
        const data = await informationSystemService.getInformationSystemDetailedInfo(record.id);
        console.log('成功获取系统详细信息:', data);
        setDetailedInfo(data);
      } catch (error) {
        console.error('获取系统详细信息失败:', error);
        console.error('错误详情:', error.response || error);
        message.error(`获取系统详细信息失败: ${error.message || '未知错误'}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [record.id]);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>;
  }

  if (!detailedInfo) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>暂无详细信息</div>;
  }

  return (
    <div style={{ padding: '0 24px' }}>
      <Tabs
        size="small"
        items={[
          {
            key: 'products',
            label: `关联产品 (${detailedInfo.products?.length || 0})`,
            children: detailedInfo.products && detailedInfo.products.length > 0 ? (
              <Table
                dataSource={detailedInfo.products}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '产品名称', dataIndex: 'name', key: 'name' },
                  { title: '产品类型', dataIndex: 'product_type_display', key: 'product_type' },
                  {
                    title: '基础价格',
                    dataIndex: 'base_price',
                    key: 'base_price',
                    render: (price) => `¥${parseFloat(price).toFixed(2)}`
                  },
                  { title: '计费单位', dataIndex: 'billing_unit', key: 'billing_unit' },
                  {
                    title: 'CPU容量',
                    dataIndex: 'cpu_capacity',
                    key: 'cpu_capacity',
                    render: (cpu) => cpu ? `${cpu} 核` : '-'
                  },
                  {
                    title: '内存容量',
                    dataIndex: 'memory_capacity',
                    key: 'memory_capacity',
                    render: (mem) => mem ? `${mem} GB` : '-'
                  },
                  {
                    title: '存储容量',
                    dataIndex: 'storage_capacity',
                    key: 'storage_capacity',
                    render: (storage) => storage ? `${storage} GB` : '-'
                  }
                ]}
              />
            ) : (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无关联产品</p>
            )
          },
          {
            key: 'services',
            label: `关联服务 (${detailedInfo.services?.length || 0})`,
            children: detailedInfo.services && detailedInfo.services.length > 0 ? (
              <Table
                dataSource={detailedInfo.services}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '服务名称', dataIndex: 'name', key: 'name' },
                  { title: '服务类型', dataIndex: 'service_type_display', key: 'service_type' },
                  {
                    title: '基础价格',
                    dataIndex: 'base_price',
                    key: 'base_price',
                    render: (price) => `¥${parseFloat(price).toFixed(2)}`
                  },
                  { title: '计费周期', dataIndex: 'billing_cycle', key: 'billing_cycle' },
                  { title: 'SLA级别', dataIndex: 'sla_level', key: 'sla_level' },
                  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true }
                ]}
              />
            ) : (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无关联服务</p>
            )
          },
          {
            key: 'vms',
            label: `虚拟机 (${detailedInfo.virtual_machines?.length || 0})`,
            children: detailedInfo.vms_by_datacenter && Object.keys(detailedInfo.vms_by_datacenter).length > 0 ? (
              <div>
                {Object.entries(detailedInfo.vms_by_datacenter).map(([datacenter, vms]) => (
                  <div key={datacenter} style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '8px' }}>数据中心: {datacenter}</h4>
                    <Table
                      dataSource={vms}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={[
                        { title: '虚拟机名称', dataIndex: 'name', key: 'name' },
                        {
                          title: 'CPU',
                          dataIndex: 'cpu_cores',
                          key: 'cpu_cores',
                          render: (cpu) => `${cpu} 核`
                        },
                        {
                          title: '内存',
                          dataIndex: 'memory_gb',
                          key: 'memory_gb',
                          render: (mem) => `${mem} GB`
                        },
                        {
                          title: '存储',
                          dataIndex: 'disk_gb',
                          key: 'disk_gb',
                          render: (disk) => `${disk} GB`
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          key: 'status',
                          render: (status) => (
                            <Tag color={status === 'active' ? 'green' : status === 'shutoff' ? 'red' : 'orange'}>
                              {status === 'active' ? '运行中' : status === 'shutoff' ? '已关机' : status}
                            </Tag>
                          )
                        }
                      ]}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无虚拟机</p>
            )
          },
          {
            key: 'billing',
            label: `计费记录 (${detailedInfo.daily_billing?.length || 0})`,
            children: (
              <div>
                {detailedInfo.monthly_cost && (
                  <Card size="small" style={{ marginBottom: '16px', background: '#f0f2f5' }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic
                          title="本月成本"
                          value={parseFloat(detailedInfo.monthly_cost).toFixed(2)}
                          prefix="¥"
                          valueStyle={{ color: '#cf1322' }}
                        />
                      </Col>
                    </Row>
                  </Card>
                )}
                {detailedInfo.daily_billing && detailedInfo.daily_billing.length > 0 ? (
                  <Table
                    dataSource={detailedInfo.daily_billing}
                    rowKey="billing_date"
                    size="small"
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: '日期',
                        dataIndex: 'billing_date',
                        key: 'billing_date'
                      },
                      { title: 'CPU(核)', dataIndex: 'cpu_cores', key: 'cpu_cores' },
                      { title: '内存(GB)', dataIndex: 'memory_gb', key: 'memory_gb' },
                      { title: '存储(GB)', dataIndex: 'storage_gb', key: 'storage_gb' },
                      { title: '运行小时', dataIndex: 'running_hours', key: 'running_hours' },
                      {
                        title: '折扣率',
                        dataIndex: 'discount_rate',
                        key: 'discount_rate',
                        render: (rate) => rate ? `${(parseFloat(rate) * 100).toFixed(0)}%` : '-'
                      },
                      {
                        title: '总费用',
                        dataIndex: 'actual_daily_cost',
                        key: 'actual_daily_cost',
                        render: (cost) => `¥${parseFloat(cost).toFixed(2)}`
                      }
                    ]}
                  />
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无计费记录</p>
                )}
              </div>
            )
          },
          {
            key: 'adjustments',
            label: `资源调整历史 (${detailedInfo.resource_adjustments?.length || 0})`,
            children: detailedInfo.resource_adjustments && detailedInfo.resource_adjustments.length > 0 ? (
              <Table
                dataSource={detailedInfo.resource_adjustments}
                rowKey="adjustment_date"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: '调整时间',
                    dataIndex: 'adjustment_date',
                    key: 'adjustment_date'
                  },
                  {
                    title: 'CPU变化',
                    key: 'cpu_change',
                    render: (_, record) => `${record.old_cpu} → ${record.new_cpu}`
                  },
                  {
                    title: '内存变化',
                    key: 'memory_change',
                    render: (_, record) => `${record.old_memory} → ${record.new_memory}`
                  },
                  {
                    title: '存储变化',
                    key: 'storage_change',
                    render: (_, record) => `${record.old_storage} → ${record.new_storage}`
                  },
                  { title: '调整详情', dataIndex: 'adjustment_detail', key: 'adjustment_detail', ellipsis: true },
                  { title: '操作人', dataIndex: 'operator', key: 'operator' }
                ]}
              />
            ) : (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无资源调整历史</p>
            )
          }
        ]}
      />
    </div>
  );
};

const TenantManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create or edit
  const [currentTenant, setCurrentTenant] = useState(null);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    level: undefined,
    tenant_type: undefined,
    status: undefined
  });

  useEffect(() => {
    fetchTenants();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize, filters]);

  // 获取租户列表
  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        search: filters.search || undefined,
        level: filters.level,
        tenant_type: filters.tenant_type,
        status: filters.status
      };

      const response = await tenantService.getTenants(params);

      setTenants(response.results || response);
      setPagination({
        ...pagination,
        total: response.count || response.length
      });
    } catch (error) {
      message.error('获取租户列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  // 获取统计信息
  const fetchStatistics = async () => {
    try {
      const statsData = await tenantService.getTenantStatistics();
      setStats(statsData);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  // 处理表格变化
  const handleTableChange = (newPagination, tableFilters, sorter) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  // 打开创建模态框
  const handleCreate = () => {
    setModalMode('create');
    setCurrentTenant(null);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (tenant) => {
    setModalMode('edit');
    setCurrentTenant(tenant);
    setModalVisible(true);
  };

  // 查看详情
  const handleView = async (tenant) => {
    try {
      // 获取干系人信息
      const stakeholdersResponse = await tenantService.getTenantStakeholders(tenant.id);
      const stakeholders = stakeholdersResponse.results || stakeholdersResponse;

      // 获取信息系统信息
      const systemsResponse = await tenantService.getTenantInformationSystems(tenant.id);
      const informationSystems = systemsResponse.results || systemsResponse;

      // 获取合同信息
      let contracts = [];
      try {
        const contractsResponse = await contractService.getContracts({ tenant: tenant.id });
        contracts = contractsResponse.results || contractsResponse;
      } catch (error) {
        console.error('获取合同信息失败:', error);
      }

      const tabItems = [
        {
          key: 'basic',
          label: (
            <span>
              <SafetyCertificateOutlined />
              基本信息
            </span>
          ),
          children: (
            <div>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>租户名称：</strong>{tenant.name}</p>
                  <p><strong>租户编码：</strong>{tenant.code}</p>
                  <p><strong>租户级别：</strong>{tenant.level}</p>
                  <p><strong>折扣级别：</strong>{tenant.discount_level}</p>
                  <p><strong>折扣率：</strong>{tenant.discount_rate ? `${(tenant.discount_rate * 100).toFixed(1)}%` : '无'}</p>
                </Col>
                <Col span={12}>
                  <p><strong>租户类型：</strong>{tenant.tenant_type}</p>
                  <p><strong>状态：</strong>
                    <Tag color={getStatusColor(tenant.status)}>
                      {getStatusText(tenant.status)}
                    </Tag>
                  </p>
                  <p><strong>开始时间：</strong>{formatDate(tenant.start_time)}</p>
                  <p><strong>结束时间：</strong>{formatDate(tenant.end_time)}</p>
                  <p><strong>创建时间：</strong>{formatDate(tenant.created_at)}</p>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <p><strong>联系人：</strong>{tenant.contact_person}</p>
                  <p><strong>联系电话：</strong>{tenant.contact_phone}</p>
                  <p><strong>联系邮箱：</strong>{tenant.contact_email}</p>
                  <p><strong>地址：</strong>{tenant.address || '-'}</p>
                  <p><strong>描述：</strong>{tenant.description || '-'}</p>
                </Col>
              </Row>
            </div>
          ),
        },
        {
          key: 'stakeholders',
          label: (
            <span>
              <UserOutlined />
              干系人 ({stakeholders.length})
            </span>
          ),
          children: (
            <div>
              {stakeholders.length > 0 ? (
                <Table
                  dataSource={stakeholders}
                  columns={[
                    {
                      title: '姓名',
                      dataIndex: 'name',
                      key: 'name',
                    },
                    {
                      title: '类型',
                      dataIndex: 'stakeholder_type_display',
                      key: 'stakeholder_type',
                      render: (type) => (
                        <Tag color={
                          type === '客户' ? 'blue' :
                            type === '项目交付团队' ? 'green' : 'orange'
                        }>
                          {type}
                        </Tag>
                      )
                    },
                    {
                      title: '电话',
                      dataIndex: 'phone',
                      key: 'phone',
                    },
                    {
                      title: '邮箱',
                      dataIndex: 'email',
                      key: 'email',
                    },
                    {
                      title: '职位',
                      dataIndex: 'position',
                      key: 'position',
                    },
                    {
                      title: '部门',
                      dataIndex: 'department',
                      key: 'department',
                    },
                    {
                      title: '主要联系人',
                      dataIndex: 'is_primary',
                      key: 'is_primary',
                      render: (primary) => primary ? <Tag color="green">是</Tag> : <Tag>否</Tag>
                    }
                  ]}
                  pagination={false}
                  size="small"
                />
              ) : (
                <p style={{ textAlign: 'center', color: '#999' }}>暂无干系人信息</p>
              )}
            </div>
          ),
        },
        {
          key: 'systems',
          label: (
            <span>
              <DesktopOutlined />
              信息系统 ({informationSystems.length})
            </span>
          ),
          children: (
            <div>
              {informationSystems.length > 0 ? (
                <Table
                  dataSource={informationSystems}
                  rowKey="id"
                  columns={[
                    {
                      title: '系统名称',
                      dataIndex: 'name',
                      key: 'name',
                    },
                    {
                      title: '系统编码',
                      dataIndex: 'code',
                      key: 'code',
                    },
                    {
                      title: '系统类型',
                      dataIndex: 'system_type',
                      key: 'system_type',
                    },
                    {
                      title: '运行模式',
                      dataIndex: 'operation_mode',
                      key: 'operation_mode',
                      render: (mode) => mode === '7x24' ? '7x24小时' : '5x8小时'
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status) => (
                        <Tag color={
                          status === 'running' ? 'green' :
                            status === 'stopped' ? 'red' :
                              status === 'maintenance' ? 'orange' : 'gray'
                        }>
                          {status === 'running' ? '运行中' :
                            status === 'stopped' ? '已停止' :
                              status === 'maintenance' ? '维护中' : '异常'}
                        </Tag>
                      )
                    },
                    {
                      title: 'CPU总量',
                      dataIndex: 'total_cpu',
                      key: 'total_cpu',
                      render: (cpu) => `${cpu} 核`
                    },
                    {
                      title: '内存总量',
                      dataIndex: 'total_memory',
                      key: 'total_memory',
                      render: (memory) => `${memory} GB`
                    },
                    {
                      title: '存储总量',
                      dataIndex: 'total_storage',
                      key: 'total_storage',
                      render: (storage) => `${storage} GB`
                    }
                  ]}
                  expandable={{
                    expandedRowRender: (record) => <SystemDetailExpanded record={record} />,
                    rowExpandable: (record) => true,
                  }}
                  pagination={false}
                  size="small"
                />
              ) : (
                <p style={{ textAlign: 'center', color: '#999' }}>暂无信息系统</p>
              )}
            </div>
          ),
        },
        {
          key: 'contracts',
          label: (
            <span>
              <FileTextOutlined />
              合同管理 ({contracts.length})
            </span>
          ),
          children: (
            <div>
              {contracts.length > 0 ? (
                <Table
                  dataSource={contracts}
                  columns={[
                    {
                      title: '合同编号',
                      dataIndex: 'contract_number',
                      key: 'contract_number',
                    },
                    {
                      title: '合同名称',
                      dataIndex: 'contract_name',
                      key: 'contract_name',
                    },
                    {
                      title: '合同类型',
                      dataIndex: 'contract_type_display',
                      key: 'contract_type',
                      render: (type) => <Tag color="blue">{type}</Tag>
                    },
                    {
                      title: '合同金额',
                      dataIndex: 'total_amount',
                      key: 'total_amount',
                      render: (amount) => `¥${parseFloat(amount).toLocaleString()}`
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status) => (
                        <Tag color={
                          status === 'active' ? 'green' :
                            status === 'draft' ? 'default' :
                              status === 'pending' ? 'orange' :
                                status === 'expired' ? 'red' : 'gray'
                        }>
                          {status === 'active' ? '生效中' :
                            status === 'draft' ? '草稿' :
                              status === 'pending' ? '待审批' :
                                status === 'expired' ? '已过期' : '已终止'}
                        </Tag>
                      )
                    },
                    {
                      title: '开始日期',
                      dataIndex: 'start_date',
                      key: 'start_date',
                      render: (date) => formatDate(date)
                    },
                    {
                      title: '结束日期',
                      dataIndex: 'end_date',
                      key: 'end_date',
                      render: (date) => formatDate(date)
                    }
                  ]}
                  pagination={false}
                  size="small"
                />
              ) : (
                <p style={{ textAlign: 'center', color: '#999' }}>暂无合同信息</p>
              )}
            </div>
          ),
        },
        {
          key: 'billing',
          label: (
            <span>
              <PayCircleOutlined />
              账单管理
            </span>
          ),
          children: (
            <AdminBillingView tenantId={tenant.id} />
          ),
        },
        {
          key: 'orders',
          label: (
            <span>
              <FileTextOutlined />
              订单管理
            </span>
          ),
          children: (
            <div style={{ padding: '16px 0' }}>
              <OrderManagement tenantId={tenant.id} />
            </div>
          ),
        }
      ];

      Modal.info({
        title: `租户详情 - ${tenant.name}`,
        width: 1000,
        content: (
          <div>
            <Tabs
              defaultActiveKey="basic"
              items={tabItems}
              size="small"
            />
          </div>
        ),
        onOk() { }
      });
    } catch (error) {
      console.error('获取租户详情失败:', error);
      Modal.info({
        title: '租户详情',
        width: 800,
        content: (
          <div>
            <p><strong>租户名称：</strong>{tenant.name}</p>
            <p><strong>租户编码：</strong>{tenant.code}</p>
            <p><strong>租户级别：</strong>{tenant.level}</p>
            <p><strong>折扣级别：</strong>{tenant.discount_level}</p>
            <p><strong>租户类型：</strong>{tenant.tenant_type}</p>
            <p><strong>状态：</strong>{tenant.status}</p>
            <p><strong>联系人：</strong>{tenant.contact_person}</p>
            <p><strong>联系电话：</strong>{tenant.contact_phone}</p>
            <p><strong>联系邮箱：</strong>{tenant.contact_email}</p>
            <p><strong>描述：</strong>{tenant.description || '-'}</p>
          </div>
        ),
        onOk() { }
      });
    }
  };

  // 提交表单
  const handleSubmit = async (values) => {
    try {
      if (modalMode === 'create') {
        await tenantService.createTenant(values);
        message.success('创建成功');
      } else {
        await tenantService.updateTenant(currentTenant.id, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      fetchTenants();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  // 删除租户
  const handleDelete = async (id) => {
    try {
      await tenantService.deleteTenant(id);
      fetchTenants();
      fetchStatistics();
    } catch (error) {
      throw error;
    }
  };

  // 激活租户
  const handleActivate = async (id) => {
    try {
      await tenantService.activateTenant(id);
      fetchTenants();
      fetchStatistics();
    } catch (error) {
      throw error;
    }
  };

  // 暂停租户
  const handleSuspend = async (id) => {
    try {
      await tenantService.suspendTenant(id);
      fetchTenants();
      fetchStatistics();
    } catch (error) {
      throw error;
    }
  };

  // 终止租户
  const handleTerminate = async (id) => {
    try {
      await tenantService.terminateTenant(id);
      fetchTenants();
      fetchStatistics();
    } catch (error) {
      throw error;
    }
  };

  // 搜索
  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  // 筛选
  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  // 刷新
  const handleRefresh = () => {
    fetchTenants();
    fetchStatistics();
  };

  // 导出
  const handleExport = () => {
    if (tenants.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    const exportData = tenants.map(tenant => ({
      租户名称: tenant.name,
      租户编码: tenant.code,
      租户级别: tenant.level,
      折扣级别: tenant.discount_level,
      租户类型: tenant.tenant_type,
      状态: tenant.status,
      联系人: tenant.contact_person,
      联系电话: tenant.contact_phone,
      联系邮箱: tenant.contact_email
    }));

    exportToCSV(exportData, `tenants_${Date.now()}.csv`);
    message.success('导出成功');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <TeamOutlined className="page-title-icon" />
          租户管理
        </h1>
        <p className="page-description">管理和查看所有租户信息</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总租户数"
              value={stats.total_count || 0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃租户"
              value={stats.active_count || 0}
              valueStyle={{ color: '#52c41a' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={stats.pending_count || 0}
              valueStyle={{ color: '#faad14' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="暂停/终止"
              value={(stats.suspended_count || 0) + (stats.terminated_count || 0)}
              valueStyle={{ color: '#ff4d4f' }}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选 */}
      <div className="search-bar">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <Search
              placeholder="搜索租户名称、编码、联系人等"
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: 300 }}
              onSearch={handleSearch}
            />

            <Select
              placeholder="租户级别"
              allowClear
              style={{ width: 150 }}
              onChange={(value) => handleFilterChange('level', value)}
            >
              <Option value="superior">上级单位</Option>
              <Option value="important">重要客户</Option>
              <Option value="ordinary">普通客户</Option>
            </Select>

            <Select
              placeholder="租户类型"
              allowClear
              style={{ width: 200 }}
              onChange={(value) => handleFilterChange('tenant_type', value)}
            >
              <Option value="virtual">虚拟资源</Option>
              <Option value="virtual_physical">虚拟+物理资源</Option>
              <Option value="virtual_physical_network">虚拟+物理+网络线路资源</Option>
              <Option value="datacenter_cabinet">机房机柜资源</Option>
            </Select>

            <Select
              placeholder="状态"
              allowClear
              style={{ width: 120 }}
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="active">活跃</Option>
              <Option value="pending">待审核</Option>
              <Option value="suspended">暂停</Option>
              <Option value="terminated">终止</Option>
            </Select>

            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>

            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>

            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建租户
            </Button>
          </Space>
        </Space>
      </div>

      {/* 租户表格 */}
      <TenantTable
        dataSource={tenants}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
        onChange={handleTableChange}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onActivate={handleActivate}
        onSuspend={handleSuspend}
        onTerminate={handleTerminate}
      />

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建租户' : '编辑租户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={900}
        destroyOnHidden
      >
        <TenantForm
          initialValues={currentTenant}
          onSubmit={handleSubmit}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default TenantManagement;