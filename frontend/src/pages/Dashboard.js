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

  useEffect(() => {
    fetchDashboardData();
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

  // 系统状态
  const systemStatus = [
    { name: '计算服务', status: 'running', uptime: '99.9%', color: 'success' },
    { name: '存储服务', status: 'running', uptime: '99.8%', color: 'success' },
    { name: '网络服务', status: 'running', uptime: '99.9%', color: 'success' },
    { name: '数据库服务', status: 'running', uptime: '99.7%', color: 'success' }
  ];

  // 最近活动
  const recentActivities = [
    {
      time: '2分钟前',
      type: 'success',
      content: '用户 admin_test 登录系统'
    },
    {
      time: '15分钟前',
      type: 'info',
      content: '租户"测试租户公司"创建了新用户'
    },
    {
      time: '1小时前',
      type: 'warning',
      content: '合同 CON-2024-001 即将到期'
    },
    {
      time: '2小时前',
      type: 'success',
      content: '系统完成自动备份'
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
              value={99.8}
              prefix={<RiseOutlined />}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#722ed1' }}
            />
            <Divider style={{ margin: '12px 0' }} />
            <Text type="secondary" style={{ fontSize: '13px' }}>
              所有服务运行正常
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
          >
            <Table
              dataSource={systemStatus}
              columns={statusColumns}
              pagination={false}
              size="middle"
              rowKey="name"
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
          >
            <Timeline
              items={recentActivities.map(activity => ({
                color: activity.type === 'success' ? 'green' :
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
          </Card>
        </Col>
      </Row>

      {/* 资源使用概览 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card title="CPU 使用率" size="small" bordered={false}>
            <Progress
              type="dashboard"
              percent={45}
              strokeColor="#1668dc"
            />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              当前负载：中等
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card title="内存使用率" size="small" bordered={false}>
            <Progress
              type="dashboard"
              percent={62}
              strokeColor="#52c41a"
            />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              当前负载：正常
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card title="存储使用率" size="small" bordered={false}>
            <Progress
              type="dashboard"
              percent={38}
              strokeColor="#faad14"
            />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              当前负载：良好
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;