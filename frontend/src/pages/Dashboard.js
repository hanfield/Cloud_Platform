/**
 * 云平台主页 - 仪表板
 */

import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Table, Tag, Timeline,
  Button, Space, Typography, Divider, Alert, message, Modal
} from 'antd';
import {
  CloudServerOutlined, TeamOutlined, FileTextOutlined,
  DashboardOutlined, RiseOutlined, SafetyOutlined,
  ThunderboltOutlined, DatabaseOutlined, ApiOutlined,
  CheckCircleOutlined, WarningOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import tenantService from '../services/tenantService';
import userService from '../services/userService';
import contractService from '../services/contractService';
import api from '../services/api';

import AdminResourceCreate from '../components/AdminResourceCreate';
import VMCreateWizard from '../components/VMCreateWizard';

const { Title, Text, Paragraph } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    tenants: { total: 0, active: 0 },
    users: { total: 0, active: 0, pending: 0 },
    contracts: { total: 0, active: 0 }
  });

  // 管理员资源创建模态框状态
  const [createSystemModalVisible, setCreateSystemModalVisible] = useState(false);
  const [createVMModalVisible, setCreateVMModalVisible] = useState(false);
  const [systems, setSystems] = useState([]);
  const [selectedSystemId, setSelectedSystemId] = useState(null);

  // 监控数据
  const [resources, setResources] = useState({
    cpu_usage: 0,
    memory_usage: 0,
    disk_usage: 0
  });
  const [services, setServices] = useState([]);
  const [activities, setActivities] = useState([]);
  const [healthScore, setHealthScore] = useState(99.8);

  useEffect(() => {
    fetchDashboardData();
    fetchMonitoringData();

    // 每5秒刷新一次监控数据
    const interval = setInterval(fetchMonitoringData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [tenantStats, userStats, contractStats] = await Promise.all([
        tenantService.getTenantStatistics(),
        userService.getUserStatistics(),
        contractService.getContractStatistics()
      ]);

      setStats({
        tenants: tenantStats,
        users: userStats,
        contracts: contractStats
      });
    } catch (error) {
      console.error('获取仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonitoringData = async () => {
    try {
      // 获取系统资源
      try {
        const resourcesData = await api.get('/monitoring/resources/');
        if (resourcesData) {
          setResources(resourcesData);
        }
      } catch (e) { console.error('Resources fetch failed', e); }

      // 获取服务状态
      try {
        const servicesData = await api.get('/monitoring/services/');
        if (servicesData) {
          setServices(servicesData.services || []);
        }
      } catch (e) { console.error('Services fetch failed', e); }

      // 获取最近活动
      try {
        const activitiesData = await api.get('/monitoring/activities/?limit=5');
        if (activitiesData) {
          setActivities(activitiesData);
        }
      } catch (e) { console.error('Activities fetch failed', e); }

      // 获取健康度
      try {
        const healthData = await api.get('/monitoring/health/');
        if (healthData) {
          setHealthScore(healthData.health_score);
        }
      } catch (e) { console.error('Health fetch failed', e); }

    } catch (error) {
      console.error('获取监控数据失败:', error);
    }
  };


  // 快捷操作
  const quickActions = [
    {
      title: '创建租户',
      icon: <TeamOutlined />,
      color: '#1668dc',
      onClick: () => navigate('/tenants')
    },
    {
      title: '为租户建系统',
      icon: <DatabaseOutlined />,
      color: '#722ed1',
      onClick: () => setCreateSystemModalVisible(true)
    },
    {
      title: '为租户建VM',
      icon: <CloudServerOutlined />,
      color: '#13c2c2',
      onClick: () => setCreateVMModalVisible(true)
    },
    {
      title: '合同管理',
      icon: <FileTextOutlined />,
      color: '#faad14',
      onClick: () => navigate('/contracts')
    }
  ];

  const statusColumns = [
    {
      title: '服务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <ApiOutlined />
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          运行中
        </Tag>
      )
    },
    {
      title: '可用性',
      dataIndex: 'uptime',
      key: 'uptime',
      render: (uptime) => (
        <Space>
          <Progress
            percent={parseFloat(uptime)}
            size="small"
            style={{ width: 100 }}
            strokeColor="#52c41a"
          />
          <Text>{uptime}</Text>
        </Space>
      )
    }
  ];

  // 活动日志模态框
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [fullActivities, setFullActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const fetchFullActivities = async () => {
    setActivitiesLoading(true);
    try {
      const data = await api.get('/monitoring/activities/?full=true&limit=100');
      if (data && data.results) {
        setFullActivities(data.results);
      }
    } catch (error) {
      console.error('获取完整活动日志失败:', error);
      message.error('获取活动日志失败');
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleOpenActivityModal = () => {
    setActivityModalVisible(true);
    fetchFullActivities();
  };

  const activityColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '操作',
      dataIndex: 'action_type_display',
      key: 'action_type_display',
      width: 100,
      render: (text, record) => (
        <Tag color={record.action_type === 'delete' ? 'red' : record.action_type === 'create' ? 'green' : 'blue'}>
          {text}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      dataIndex: 'status_display',
      key: 'status',
      width: 80,
      render: (text, record) => (
        <Tag color={record.status === 'success' ? 'success' : 'error'}>
          {text}
        </Tag>
      )
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120,
    }
  ];

  return (
    <div className="page-container">
      {/* 页面标题 */}
      <div className="page-header">
        <Title level={2}>
          <DashboardOutlined className="page-title-icon" />
          云平台管理控制台
        </Title>
        <Paragraph type="secondary">
          欢迎使用云平台管理系统，这里是您的数据中心
        </Paragraph>
      </div>

      {/* 欢迎横幅 */}
      <Alert
        message="系统运行正常"
        description="所有服务运行稳定，当前无告警信息。上次系统检查时间：刚刚"
        type="success"
        showIcon
        icon={<SafetyOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* 核心统计数据 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} hoverable className="animate-slide-up delay-100">
            <Statistic
              title="租户总数"
              value={stats.tenants.total_count || 0}
              prefix={<TeamOutlined />}
              suffix="个"
              valueStyle={{ color: '#1668dc' }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: '13px' }}>
              活跃: {stats.tenants.active_count || 0} |
              暂停: {stats.tenants.suspended_count || 0}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} hoverable className="animate-slide-up delay-200">
            <Statistic
              title="用户总数"
              value={stats.users.total_count || 0}
              prefix={<TeamOutlined />}
              suffix="人"
              valueStyle={{ color: '#52c41a' }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: '13px' }}>
              活跃: {stats.users.active_count || 0} |
              待审核: {stats.users.pending_count || 0}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} hoverable className="animate-slide-up delay-300">
            <Statistic
              title="合同总数"
              value={stats.contracts.total_count || 0}
              prefix={<FileTextOutlined />}
              suffix="份"
              valueStyle={{ color: '#faad14' }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: '13px' }}>
              生效中: {stats.contracts.active_count || 0} |
              即将到期: {stats.contracts.expiring_count || 0}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} hoverable className="animate-slide-up delay-400">
            <Statistic
              title="系统健康度"
              value={healthScore}
              prefix={<RiseOutlined />}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#722ed1' }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: '13px' }}>
              {healthScore > 90 ? '所有服务运行正常' : healthScore > 70 ? '系统运行良好' : '需要关注'}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 快捷操作 */}
      <Card
        bordered={false}
        title={
          <Space>
            <ThunderboltOutlined />
            <span>快捷操作</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          {quickActions.map((action, index) => (
            <Col xs={24} sm={12} md={6} key={index}>
              <Card
                bordered={false}
                hoverable
                onClick={action.onClick}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  border: `1px solid ${action.color}20`,
                }}
                bodyStyle={{ padding: '24px 16px' }}
              >
                <div style={{ fontSize: 32, color: action.color, marginBottom: 12 }}>
                  {action.icon}
                </div>
                <Text strong style={{ fontSize: '14px' }}>{action.title}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {/* 系统服务状态 */}
        <Col xs={24} lg={14}>
          <Card
            bordered={false}
            title={
              <Space>
                <DatabaseOutlined />
                <span>系统服务状态</span>
              </Space>
            }
            extra={<Tag color="success">全部正常</Tag>}
            bodyStyle={{ minHeight: 280 }}
          >
            <Table
              dataSource={services}
              columns={statusColumns}
              pagination={false}
              size="middle"
              rowKey="name"
              loading={services.length === 0}
            />
          </Card>
        </Col>

        {/* 最近活动 */}
        <Col xs={24} lg={10}>
          <Card
            bordered={false}
            title={
              <Space>
                <ClockCircleOutlined />
                <span>最近活动</span>
              </Space>
            }
            extra={<Button type="link" size="small" onClick={handleOpenActivityModal}>查看全部</Button>}
            bodyStyle={{ minHeight: 280 }}
          >
            {activities.length > 0 ? (
              <Timeline
                items={activities.map(activity => ({
                  color: activity.type === 'success' || activity.type === 'login' ? 'green' :
                    activity.type === 'warning' ? 'orange' : 'blue',
                  children: (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {activity.time}
                      </Text>
                      <div>{activity.content}</div>
                    </div>
                  )
                }))}
              />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 280,
                color: '#999'
              }}>
                <Text type="secondary">暂无活动记录</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 资源使用概览 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card title="CPU 使用率" size="small" bordered={false}>
            <Progress
              type="dashboard"
              percent={Math.round(resources.cpu_usage || 0)}
              strokeColor="#1668dc"
            />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              当前负载：{resources.cpu_usage > 70 ? '较高' : resources.cpu_usage > 40 ? '中等' : '良好'}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card title="内存使用率" size="small" bordered={false}>
            <Progress
              type="dashboard"
              percent={Math.round(resources.memory_usage || 0)}
              strokeColor="#52c41a"
            />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              当前负载：{resources.memory_usage > 80 ? '较高' : resources.memory_usage > 50 ? '正常' : '良好'}
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card title="存储使用率" size="small" bordered={false}>
            <Progress
              type="dashboard"
              percent={Math.round(resources.disk_usage || 0)}
              strokeColor="#faad14"
            />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              当前负载：{resources.disk_usage > 85 ? '需注意' : resources.disk_usage > 60 ? '正常' : '良好'}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 创建信息系统 */}
      <AdminResourceCreate
        visible={createSystemModalVisible}
        type="system"
        onCancel={() => setCreateSystemModalVisible(false)}
        onSuccess={() => {
          message.success('信息系统创建成功');
        }}
      />

      {/* 创建虚拟机 */}
      <VMCreateWizard
        visible={createVMModalVisible}
        onCancel={() => setCreateVMModalVisible(false)}
        onSuccess={() => {
          message.success('虚拟机创建成功');
        }}
        systems={systems}
        selectedSystemId={selectedSystemId}
        isAdmin={true}
      />

      {/* 活动日志详情模态框 */}
      <Modal
        title={
          <Space>
            <ClockCircleOutlined />
            <span>系统活动日志</span>
          </Space>
        }
        open={activityModalVisible}
        onCancel={() => setActivityModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setActivityModalVisible(false)}>
            关闭
          </Button>,
          <Button key="refresh" type="primary" onClick={fetchFullActivities} loading={activitiesLoading}>
            刷新
          </Button>
        ]}
      >
        <Table
          dataSource={fullActivities}
          columns={activityColumns}
          rowKey="id"
          loading={activitiesLoading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default Dashboard;