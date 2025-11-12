/**
 * 租户管理页面
 */

import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Select, Space, message, Row, Col, Card, Statistic } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  TeamOutlined,
  ExportOutlined
} from '@ant-design/icons';
import TenantTable from '../components/TenantTable';
import TenantForm from '../components/TenantForm';
import tenantService from '../services/tenantService';
import { exportToCSV } from '../utils/helpers';

const { Search } = Input;
const { Option } = Select;

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
  const fetchTenants = async () => {
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
  };

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
  const handleView = (tenant) => {
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
      onOk() {}
    });
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
        destroyOnClose
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