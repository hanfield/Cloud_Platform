/**
 * 信息系统管理页面
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
  DesktopOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import InformationSystemTable from '../components/InformationSystemTable';
import InformationSystemForm from '../components/InformationSystemForm';
import InformationSystemResources from '../components/InformationSystemResources';
import informationSystemService from '../services/informationSystemService';
import { exportToCSV } from '../utils/helpers';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const InformationSystemManagement = () => {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create or edit
  const [currentSystem, setCurrentSystem] = useState(null);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: undefined,
    operation_mode: undefined
  });

  useEffect(() => {
    fetchInformationSystems();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize, filters]);

  // 获取信息系统列表
  const fetchInformationSystems = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        search: filters.search || undefined,
        status: filters.status,
        operation_mode: filters.operation_mode
      };

      const response = await informationSystemService.getInformationSystems(params);

      setSystems(response?.results || response || []);
      setPagination({
        ...pagination,
        total: response?.count || response?.length || 0
      });
    } catch (error) {
      message.error('获取信息系统列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取统计信息
  const fetchStatistics = async () => {
    try {
      const statsData = await informationSystemService.getInformationSystemStatistics();
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
    setCurrentSystem(null);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (system) => {
    setModalMode('edit');
    setCurrentSystem(system);
    setModalVisible(true);
  };

  // 查看详情
  const handleView = async (system) => {
    try {
      const systemDetail = await informationSystemService.getInformationSystem(system.id);
      const resources = await informationSystemService.getInformationSystemResources(system.id);
      const billingInfo = await informationSystemService.getInformationSystemBillingInfo(system.id);
      const runtimeStats = await informationSystemService.getInformationSystemRuntimeStats(system.id);

      Modal.info({
        title: '信息系统详情',
        width: 1000,
        content: (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3>基本信息</h3>
              <Row gutter={16}>
                <Col span={8}>
                  <p><strong>系统名称：</strong>{systemDetail.name}</p>
                  <p><strong>系统编码：</strong>{systemDetail.code}</p>
                  <p><strong>系统类型：</strong>{systemDetail.system_type}</p>
                </Col>
                <Col span={8}>
                  <p><strong>运行模式：</strong>{systemDetail.operation_mode}</p>
                  <p><strong>状态：</strong>
                    <Tag color={systemDetail.status === 'running' ? 'green' : systemDetail.status === 'stopped' ? 'red' : 'orange'}>
                      {systemDetail.status === 'running' ? '运行中' : systemDetail.status === 'stopped' ? '已停止' : '维护中'}
                    </Tag>
                  </p>
                  <p><strong>所属租户：</strong>{systemDetail.tenant?.name}</p>
                </Col>
                <Col span={8}>
                  <p><strong>CPU总量：</strong>{systemDetail.total_cpu || 0} 核</p>
                  <p><strong>内存总量：</strong>{systemDetail.total_memory || 0} GB</p>
                  <p><strong>存储总量：</strong>{systemDetail.total_storage || 0} GB</p>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3>运行信息</h3>
              <Row gutter={16}>
                <Col span={6}>
                  <p><strong>最新启动时间：</strong>{runtimeStats.latest_start_time || '-'}</p>
                </Col>
                <Col span={6}>
                  <p><strong>运行时长：</strong>{runtimeStats.running_duration || '-'}</p>
                </Col>
                <Col span={6}>
                  <p><strong>本月运行天数：</strong>{runtimeStats.current_month_running_days || 0} 天</p>
                </Col>
                <Col span={6}>
                  <p><strong>可用性：</strong>{runtimeStats.availability_rate || 0}%</p>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3>费用信息</h3>
              <Row gutter={16}>
                <Col span={6}>
                  <p><strong>当月应收费用：</strong>¥{billingInfo.current_month_amount || 0}</p>
                </Col>
                <Col span={6}>
                  <p><strong>计费周期：</strong>{billingInfo.billing_period || '-'}</p>
                </Col>
                <Col span={6}>
                  <p><strong>折扣率：</strong>{billingInfo.discount_rate || 1.0}</p>
                </Col>
                <Col span={6}>
                  <p><strong>实际费用：</strong>¥{billingInfo.actual_amount || 0}</p>
                </Col>
              </Row>
            </div>

            <div>
              <h3>资源详情</h3>
              {resources && resources.length > 0 ? (
                <InformationSystemResources resources={resources} />
              ) : (
                <p>暂无资源信息</p>
              )}
            </div>
          </div>
        ),
        onOk() {}
      });
    } catch (error) {
      message.error('获取系统详情失败: ' + error.message);
    }
  };

  // 提交表单
  const handleSubmit = async (values) => {
    try {
      if (modalMode === 'create') {
        await informationSystemService.createInformationSystem(values);
        message.success('创建成功');
      } else {
        await informationSystemService.updateInformationSystem(currentSystem.id, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      fetchInformationSystems();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  // 删除信息系统
  const handleDelete = async (id) => {
    try {
      await informationSystemService.deleteInformationSystem(id);
      fetchInformationSystems();
      fetchStatistics();
    } catch (error) {
      throw error;
    }
  };

  // 启动信息系统
  const handleStart = async (id) => {
    try {
      await informationSystemService.updateInformationSystemStatus(id, 'running');
      message.success('启动成功');
      fetchInformationSystems();
    } catch (error) {
      throw error;
    }
  };

  // 停止信息系统
  const handleStop = async (id) => {
    try {
      await informationSystemService.updateInformationSystemStatus(id, 'stopped');
      message.success('停止成功');
      fetchInformationSystems();
    } catch (error) {
      throw error;
    }
  };

  // 维护信息系统
  const handleMaintain = async (id) => {
    try {
      await informationSystemService.updateInformationSystemStatus(id, 'maintenance');
      message.success('进入维护模式');
      fetchInformationSystems();
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
    fetchInformationSystems();
    fetchStatistics();
  };

  // 导出
  const handleExport = () => {
    if (systems.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    const exportData = systems.map(system => ({
      系统名称: system.name,
      系统编码: system.code,
      系统类型: system.system_type,
      运行模式: system.operation_mode,
      状态: system.status === 'running' ? '运行中' : system.status === 'stopped' ? '已停止' : '维护中',
      CPU总量: system.total_cpu,
      内存总量: system.total_memory,
      存储总量: system.total_storage,
      所属租户: system.tenant?.name,
      描述: system.description || '-'
    }));

    exportToCSV(exportData, `information_systems_${Date.now()}.csv`);
    message.success('导出成功');
  };

  // 渲染统计卡片
  const renderStatisticsCards = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="总系统数"
            value={stats.total_count || 0}
            prefix={<DesktopOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="运行中"
            value={stats.running_count || 0}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CloudServerOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="总资源量"
            value={stats.total_resources || 0}
            prefix={<DatabaseOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="当月应收"
            value={stats.current_month_revenue || 0}
            valueStyle={{ color: '#1890ff' }}
            prefix={<DollarOutlined />}
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
          <DesktopOutlined className="page-title-icon" />
          信息系统管理
        </h1>
        <p className="page-description">管理和查看所有信息系统及其资源情况</p>
      </div>

      {/* 统计卡片 */}
      {renderStatisticsCards()}

      {/* 标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="系统总览" key="overview">
            {/* 搜索和筛选 */}
            <div className="search-bar" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Space wrap>
                  <Search
                    placeholder="搜索系统名称、编码、描述等"
                    allowClear
                    enterButton={<SearchOutlined />}
                    style={{ width: 300 }}
                    onSearch={handleSearch}
                  />

                  <Select
                    placeholder="运行状态"
                    allowClear
                    style={{ width: 120 }}
                    onChange={(value) => handleFilterChange('status', value)}
                  >
                    <Option value="running">运行中</Option>
                    <Option value="stopped">已停止</Option>
                    <Option value="maintenance">维护中</Option>
                  </Select>

                  <Select
                    placeholder="运行模式"
                    allowClear
                    style={{ width: 150 }}
                    onChange={(value) => handleFilterChange('operation_mode', value)}
                  >
                    <Option value="7x24">7x24小时</Option>
                    <Option value="5x8">5x8小时</Option>
                  </Select>

                  <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                    刷新
                  </Button>

                  <Button icon={<ExportOutlined />} onClick={handleExport}>
                    导出
                  </Button>

                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    新建系统
                  </Button>
                </Space>
              </Space>
            </div>

            {/* 信息系统表格 */}
            <InformationSystemTable
              dataSource={systems}
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
              onStart={handleStart}
              onStop={handleStop}
              onMaintain={handleMaintain}
            />
          </TabPane>
          <TabPane tab="资源详情" key="resources">
            <InformationSystemResources
              systems={systems}
              loading={loading}
              onRefresh={handleRefresh}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建信息系统' : '编辑信息系统'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <InformationSystemForm
          initialValues={currentSystem}
          onSubmit={handleSubmit}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default InformationSystemManagement;