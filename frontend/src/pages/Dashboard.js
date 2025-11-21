/**
 * 云平台主页 - 仪表板
 */

import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Statistic, Progress, Table, Tag, Timeline,
  Button, Space, Typography, Divider, Alert
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

const { Title, Text, Paragraph } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    tenants: { total: 0, active: 0 },
    users: { total: 0, active: 0, pending: 0 },
    contracts: { total: 0, active: 0 }
  });

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
      const token = localStorage.getItem('access_token');
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      // 获取系统资源
      const resourcesRes = await fetch('/api/monitoring/resources/', { headers });
      if (resourcesRes.ok) {
        const resourcesData = await resourcesRes.json();
        setResources(resourcesData);
      }

      // 获取服务状态
      const servicesRes = await fetch('/api/monitoring/services/', { headers });
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData.services || []);
      }

      // 获取最近活动
      const activitiesRes = await fetch('/api/monitoring/activities/?limit=5', { headers });
      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setActivities(activitiesData);
      }

      // 获取健康度
      const healthRes = await fetch('/api/monitoring/health/', { headers });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealthScore(healthData.health_score);
      }
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
      title: '用户管理',
      icon: <TeamOutlined />,
      color: '#52c41a',
      onClick: () => navigate('/users')
    },
    {
      title: '合同管理',
      icon: <FileTextOutlined />,
      color: '#faad14',
      onClick: () => navigate('/contracts')
    },
    {
      title: '云资源',
      icon: <CloudServerOutlined />,
      color: '#722ed1',
      onClick: () => navigate('/cloud-resources')
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
            extra={<Button type="link" size="small">查看全部</Button>}
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
    </div>
  );
};

export default Dashboard;