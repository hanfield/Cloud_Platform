/**
 * 信息系统资源详情组件
 */

import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Statistic, Tag, Tooltip, Button, Space, message } from 'antd';
import {
  ReloadOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';

const InformationSystemResources = ({ systems, loading, onRefresh, resources: propResources }) => {
  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    if (propResources) {
      setResources(propResources);
    } else if (systems && systems.length > 0) {
      fetchAllResources();
    }
  }, [systems, propResources]);

  const fetchAllResources = async () => {
    setLoadingResources(true);
    try {
      // 模拟资源数据 - 实际项目中应该从API获取
      const mockResources = systems.flatMap(system => [
        {
          id: `${system.id}-1`,
          system_id: system.id,
          system_name: system.name,
          zone: '可用区A',
          name: `${system.name}-主机1`,
          ip: '192.168.1.101',
          cpu: Math.floor(system.total_cpu * 0.4),
          memory: Math.floor(system.total_memory * 0.4),
          storage: Math.floor(system.total_storage * 0.4),
          start_time: moment().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss'),
          running_time: '30天',
          status: system.status === 'running' ? 'running' : 'stopped'
        },
        {
          id: `${system.id}-2`,
          system_id: system.id,
          system_name: system.name,
          zone: '可用区B',
          name: `${system.name}-主机2`,
          ip: '192.168.1.102',
          cpu: Math.floor(system.total_cpu * 0.3),
          memory: Math.floor(system.total_memory * 0.3),
          storage: Math.floor(system.total_storage * 0.3),
          start_time: moment().subtract(15, 'days').format('YYYY-MM-DD HH:mm:ss'),
          running_time: '15天',
          status: system.status === 'running' ? 'running' : 'stopped'
        },
        {
          id: `${system.id}-3`,
          system_id: system.id,
          system_name: system.name,
          zone: '可用区C',
          name: `${system.name}-存储节点`,
          ip: '192.168.1.103',
          cpu: Math.floor(system.total_cpu * 0.3),
          memory: Math.floor(system.total_memory * 0.3),
          storage: Math.floor(system.total_storage * 0.3),
          start_time: moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss'),
          running_time: '7天',
          status: system.status === 'running' ? 'running' : 'stopped'
        }
      ]);
      setResources(mockResources);
    } catch (error) {
      message.error('获取资源信息失败');
    } finally {
      setLoadingResources(false);
    }
  };

  // 状态标签颜色映射
  const statusColorMap = {
    running: 'green',
    stopped: 'red',
    maintenance: 'orange'
  };

  // 状态标签文本映射
  const statusTextMap = {
    running: '运行中',
    stopped: '已停止',
    maintenance: '维护中'
  };

  // 计算资源统计
  const calculateStats = () => {
    const totalResources = resources.length;
    const runningResources = resources.filter(r => r.status === 'running').length;
    const totalCPU = resources.reduce((sum, r) => sum + (r.cpu || 0), 0);
    const totalMemory = resources.reduce((sum, r) => sum + (r.memory || 0), 0);
    const totalStorage = resources.reduce((sum, r) => sum + (r.storage || 0), 0);

    return {
      totalResources,
      runningResources,
      totalCPU,
      totalMemory,
      totalStorage
    };
  };

  const stats = calculateStats();

  const columns = [
    {
      title: '信息系统',
      dataIndex: 'system_name',
      key: 'system_name',
      width: 150,
      ellipsis: true
    },
    {
      title: '区域',
      dataIndex: 'zone',
      key: 'zone',
      width: 100,
      render: (text) => (
        <Tag color="blue">{text}</Tag>
      )
    },
    {
      title: '资源名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 120
    },
    {
      title: 'CPU',
      dataIndex: 'cpu',
      key: 'cpu',
      width: 80,
      render: (cpu) => `${cpu || 0} 核`
    },
    {
      title: '内存',
      dataIndex: 'memory',
      key: 'memory',
      width: 80,
      render: (memory) => `${memory || 0} GB`
    },
    {
      title: '存储',
      dataIndex: 'storage',
      key: 'storage',
      width: 80,
      render: (storage) => `${storage || 0} GB`
    },
    {
      title: '开启时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 180,
      render: (time) => time || '-'
    },
    {
      title: '运行时间',
      dataIndex: 'running_time',
      key: 'running_time',
      width: 100,
      render: (time) => time || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColorMap[status]}>
          {statusTextMap[status]}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'stopped' && (
            <Tooltip title="启动">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartResource(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="停止">
              <Button
                type="link"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handleStopResource(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const handleStartResource = (resourceId) => {
    // 实际项目中应该调用API
    setResources(prev => prev.map(r =>
      r.id === resourceId ? { ...r, status: 'running' } : r
    ));
    message.success('资源启动成功');
  };

  const handleStopResource = (resourceId) => {
    // 实际项目中应该调用API
    setResources(prev => prev.map(r =>
      r.id === resourceId ? { ...r, status: 'stopped' } : r
    ));
    message.success('资源停止成功');
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      fetchAllResources();
    }
  };

  return (
    <div>
      {/* 资源统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总资源数"
              value={stats.totalResources}
              prefix={<CloudServerOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="运行中"
              value={stats.runningResources}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PlayCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="CPU总量"
              value={stats.totalCPU}
              prefix={<DatabaseOutlined />}
              suffix="核"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="内存总量"
              value={stats.totalMemory}
              prefix={<DatabaseOutlined />}
              suffix="GB"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="存储总量"
              value={stats.totalStorage}
              prefix={<DatabaseOutlined />}
              suffix="GB"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均运行时间"
              value={stats.totalResources > 0 ? Math.round(stats.runningResources / stats.totalResources * 100) : 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loadingResources}
        >
          刷新
        </Button>
      </div>

      {/* 资源表格 */}
      <Table
        columns={columns}
        dataSource={resources}
        loading={loading || loadingResources}
        rowKey="id"
        scroll={{ x: 1200 }}
        size="middle"
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          pageSize: 20
        }}
      />
    </div>
  );
};

export default InformationSystemResources;