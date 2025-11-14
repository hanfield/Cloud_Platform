/**
 * 服务管理页面
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  Input,
  Select,
  Space,
  message,
  Row,
  Col,
  Card,
  Statistic,
  Tabs,
  Tag,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  DollarOutlined
} from '@ant-design/icons';
import ServiceTable from '../components/ServiceTable';
import ServiceForm from '../components/ServiceForm';
import serviceService from '../services/serviceService';
import { exportToCSV } from '../utils/helpers';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const ServiceManagement = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create or edit
  const [currentService, setCurrentService] = useState(null);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState('services');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    service_type: undefined,
    status: undefined
  });

  useEffect(() => {
    if (activeTab === 'services') {
      fetchServices();
      fetchServiceStatistics();
    }
  }, [pagination.current, pagination.pageSize, filters, activeTab]);

  // 获取服务列表
  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        search: filters.search || undefined,
        service_type: filters.service_type,
        status: filters.status
      };

      const response = await serviceService.getServices(params);

      setServices(response?.results || response || []);
      setPagination({
        ...pagination,
        total: response?.count || response?.length || 0
      });
    } catch (error) {
      message.error('获取服务列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取服务统计信息
  const fetchServiceStatistics = async () => {
    try {
      const statsData = await serviceService.getServiceStatistics();
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
    setCurrentService(null);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (service) => {
    setModalMode('edit');
    setCurrentService(service);
    setModalVisible(true);
  };

  // 查看详情
  const handleView = async (service) => {
    try {
      const serviceDetail = await serviceService.getService(service.id);

      Modal.info({
        title: '服务详情',
        width: 800,
        content: (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3>基本信息</h3>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>服务名称：</strong>{serviceDetail.name}</p>
                  <p><strong>服务编码：</strong>{serviceDetail.code}</p>
                  <p><strong>服务类型：</strong>{serviceDetail.service_type_display}</p>
                  <p><strong>状态：</strong>
                    <Tag color={serviceDetail.status === 'active' ? 'green' : 'red'}>
                      {serviceDetail.status === 'active' ? '启用' : '停用'}
                    </Tag>
                  </p>
                </Col>
                <Col span={12}>
                  <p><strong>创建时间：</strong>{serviceDetail.created_at}</p>
                  <p><strong>更新时间：</strong>{serviceDetail.updated_at}</p>
                  <p><strong>基础价格：</strong>¥{serviceDetail.base_price || 0}</p>
                  <p><strong>计费单位：</strong>{serviceDetail.billing_unit || '-'}</p>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3>服务描述</h3>
              <p>{serviceDetail.description || '暂无描述'}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3>SLA指标</h3>
              <Row gutter={16}>
                <Col span={6}>
                  <p><strong>可用性：</strong>
                    <Tag color="blue">{serviceDetail.availability_display}</Tag>
                  </p>
                </Col>
                <Col span={6}>
                  <p><strong>MTTR：</strong>{serviceDetail.mttr_display}</p>
                </Col>
                <Col span={6}>
                  <p><strong>RPO：</strong>{serviceDetail.rpo_display}</p>
                </Col>
                <Col span={6}>
                  <p><strong>RTO：</strong>{serviceDetail.rto_display}</p>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={6}>
                  <p><strong>投诉率：</strong>{serviceDetail.complaint_rate || '-'}%</p>
                </Col>
                <Col span={6}>
                  <p><strong>网络可用性：</strong>{serviceDetail.network_availability || '-'}%</p>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3>服务特性</h3>
              <p>{serviceDetail.features || '暂无特性描述'}</p>
            </div>

            <div>
              <h3>技术规格</h3>
              <p>{serviceDetail.specifications || '暂无技术规格'}</p>
            </div>
          </div>
        ),
        onOk() {}
      });
    } catch (error) {
      message.error('获取服务详情失败: ' + error.message);
    }
  };

  // 提交表单
  const handleSubmit = async (values) => {
    try {
      if (modalMode === 'create') {
        await serviceService.createService(values);
        message.success('创建成功');
      } else {
        await serviceService.updateService(currentService.id, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      fetchServices();
      fetchServiceStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  // 删除服务
  const handleDelete = async (id) => {
    try {
      await serviceService.deleteService(id);
      message.success('删除成功');
      fetchServices();
      fetchServiceStatistics();
    } catch (error) {
      throw error;
    }
  };

  // 激活服务
  const handleActivate = async (id) => {
    try {
      await serviceService.updateService(id, { status: 'active' });
      message.success('激活成功');
      fetchServices();
    } catch (error) {
      throw error;
    }
  };

  // 停用服务
  const handleDeactivate = async (id) => {
    try {
      await serviceService.updateService(id, { status: 'inactive' });
      message.success('停用成功');
      fetchServices();
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
    fetchServices();
    fetchServiceStatistics();
  };

  // 导出
  const handleExport = () => {
    if (services.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    const exportData = services.map(service => ({
      服务名称: service.name,
      服务编码: service.code,
      服务类型: service.service_type_display,
      状态: service.status === 'active' ? '启用' : '停用',
      可用性: service.availability_display,
      MTTR: service.mttr_display,
      RPO: service.rpo_display,
      RTO: service.rto_display,
      基础价格: service.base_price || 0,
      计费单位: service.billing_unit || '-',
      计费周期: service.billing_period || '-',
      描述: service.description || '-'
    }));

    exportToCSV(exportData, `services_${Date.now()}.csv`);
    message.success('导出成功');
  };

  // 渲染统计卡片
  const renderStatisticsCards = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="总服务数"
            value={stats.total_count || 0}
            prefix={<SettingOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="启用服务"
            value={stats.active_count || 0}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="订阅用户"
            value={stats.subscription_count || 0}
            prefix={<TeamOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="月均收入"
            value={stats.monthly_revenue || 0}
            valueStyle={{ color: '#1890ff' }}
            prefix="¥"
            precision={2}
          />
        </Card>
      </Col>
    </Row>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <SettingOutlined className="page-title-icon" />
          服务管理
        </h1>
        <p className="page-description">管理和配置服务、SLA指标及订阅关系</p>
      </div>

      {/* 统计卡片 */}
      {renderStatisticsCards()}

      {/* 标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="服务管理" key="services">
            {/* 搜索和筛选 */}
            <div className="search-bar" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Space wrap>
                  <Search
                    placeholder="搜索服务名称、编码、描述等"
                    allowClear
                    enterButton={<SearchOutlined />}
                    style={{ width: 300 }}
                    onSearch={handleSearch}
                  />

                  <Select
                    placeholder="服务类型"
                    allowClear
                    style={{ width: 150 }}
                    onChange={(value) => handleFilterChange('service_type', value)}
                  >
                    <Option value="sla">SLA服务</Option>
                    <Option value="support">技术支持</Option>
                    <Option value="monitoring">监控服务</Option>
                    <Option value="backup">备份服务</Option>
                    <Option value="security">安全服务</Option>
                    <Option value="network">网络服务</Option>
                    <Option value="other">其他服务</Option>
                  </Select>

                  <Select
                    placeholder="状态"
                    allowClear
                    style={{ width: 120 }}
                    onChange={(value) => handleFilterChange('status', value)}
                  >
                    <Option value="active">启用</Option>
                    <Option value="inactive">停用</Option>
                    <Option value="draft">草稿</Option>
                    <Option value="suspended">暂停</Option>
                  </Select>

                  <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                    刷新
                  </Button>

                  <Button icon={<ExportOutlined />} onClick={handleExport}>
                    导出
                  </Button>

                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    新建服务
                  </Button>
                </Space>
              </Space>
            </div>

            {/* 服务表格 */}
            <ServiceTable
              dataSource={services}
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
              onDeactivate={handleDeactivate}
            />
          </TabPane>
          <TabPane tab="服务订阅" key="subscriptions">
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p>服务订阅管理功能开发中...</p>
              <p>这里将展示租户与服务的订阅关系管理</p>
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建服务' : '编辑服务'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <ServiceForm
          initialValues={currentService}
          onSubmit={handleSubmit}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default ServiceManagement;