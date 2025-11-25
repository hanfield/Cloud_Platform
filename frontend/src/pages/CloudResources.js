import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tabs, Table, Button, message, Tag, Space, Spin } from 'antd';
import { CloudOutlined, ReloadOutlined, DesktopOutlined, SyncOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import cloudService from '../services/cloudService';
import axios from 'axios';

const { TabPane } = Tabs;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// 虚拟机状态颜色配置
const VM_STATUS_COLORS = {
  'running': '#52c41a',
  'stopped': '#ff4d4f',
  'paused': '#faad14',
  'error': '#f5222d'
};

const CloudResources = () => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [servers, setServers] = useState([]);
  const [images, setImages] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [vmOverview, setVmOverview] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动刷新功能 - 每5秒刷新一次虚拟机数据
  useEffect(() => {
    let refreshInterval;
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        fetchVMOverview();
        setLastUpdate(new Date());
      }, 5000);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 使用 Promise.allSettled 以便每个请求独立处理，互不影响
      const [overviewRes, serversRes, imagesRes, networksRes] = await Promise.allSettled([
        cloudService.getCloudOverview().catch(err => {
          console.warn('获取云概览失败:', err);
          return { data: null };
        }),
        cloudService.getServers().catch(err => {
          console.warn('获取服务器列表失败:', err);
          return { data: [] };
        }),
        cloudService.getImages().catch(err => {
          console.warn('获取镜像列表失败:', err);
          return { data: [] };
        }),
        cloudService.getNetworks().catch(err => {
          console.warn('获取网络列表失败:', err);
          return { data: [] };
        })
      ]);

      // 设置数据，即使某些请求失败也继续
      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverview(overviewRes.value);
      }
      if (serversRes.status === 'fulfilled' && serversRes.value) {
        setServers(Array.isArray(serversRes.value) ? serversRes.value : []);
      }
      if (imagesRes.status === 'fulfilled' && imagesRes.value) {
        setImages(Array.isArray(imagesRes.value) ? imagesRes.value : []);
      }
      if (networksRes.status === 'fulfilled' && networksRes.value) {
        setNetworks(Array.isArray(networksRes.value) ? networksRes.value : []);
      }

      // 总是尝试获取虚拟机概览，不管其他API是否成功
      await fetchVMOverview();
    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('部分数据加载失败');
      // 即使出错也尝试加载VM数据
      await fetchVMOverview();
    } finally {
      setLoading(false);
    }
  };

  const fetchVMOverview = async () => {
    try {
      const token = localStorage.getItem('access_token');
      console.log('正在获取虚拟机概览数据...');
      const response = await axios.get('/api/information-systems/virtual_machines_overview/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('虚拟机概览数据:', response.data);
      setVmOverview(response.data);
    } catch (error) {
      console.error('获取虚拟机概览失败:', error);
      console.error('错误详情:', error.response?.data || error.message);
      message.error(`获取虚拟机数据失败: ${error.response?.data?.detail || error.message}`);
      // 设置为空对象以避免无限loading
      setVmOverview({
        total_vms: 0,
        status_stats: {},
        datacenter_stats: {},
        resource_totals: {},
        tenant_stats: [],
        virtual_machines: []
      });
    }
  };

  const pieData = overview ? [
    { name: '运行中', value: overview.compute?.running_instances || 0 },
    { name: '已停止', value: overview.compute?.stopped_instances || 0 }
  ] : [];

  // 虚拟机状态饼图数据
  const getVMStatusPieData = () => {
    if (!vmOverview || !vmOverview.status_stats) return [];

    const { status_stats } = vmOverview;
    return [
      { name: '运行中', value: status_stats.running || 0, color: VM_STATUS_COLORS.running },
      { name: '已停止', value: status_stats.stopped || 0, color: VM_STATUS_COLORS.stopped },
      { name: '已暂停', value: status_stats.paused || 0, color: VM_STATUS_COLORS.paused },
      { name: '异常', value: status_stats.error || 0, color: VM_STATUS_COLORS.error }
    ].filter(item => item.value > 0);
  };

  // 虚拟机状态饼图组件
  const VMStatusChart = () => {
    const data = getVMStatusPieData();
    if (data.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <DesktopOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <p>暂无虚拟机数据</p>
        </div>
      );
    }

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);

      return (
        <text
          x={x}
          y={y}
          fill="white"
          textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central"
          fontWeight="bold"
        >
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      );
    };

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // 虚拟机表格列定义
  const vmColumns = [
    {
      title: '虚拟机名称',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '租户',
      dataIndex: 'tenant_name',
      key: 'tenant_name',
      width: 120
    },
    {
      title: '所属系统',
      dataIndex: 'system_name',
      key: 'system_name',
      width: 150
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status, record) => (
        <Tag color={VM_STATUS_COLORS[status] || 'default'}>
          {record.status_display}
        </Tag>
      )
    },
    {
      title: 'CPU',
      dataIndex: 'cpu_cores',
      key: 'cpu_cores',
      width: 70,
      render: (cpu) => `${cpu}核`
    },
    {
      title: '内存',
      dataIndex: 'memory_gb',
      key: 'memory_gb',
      width: 80,
      render: (mem) => `${mem}GB`
    },
    {
      title: '磁盘',
      dataIndex: 'disk_gb',
      key: 'disk_gb',
      width: 80,
      render: (disk) => `${disk}GB`
    },
    {
      title: '数据中心',
      dataIndex: 'data_center_type_display',
      key: 'data_center_type',
      width: 100
    },
    {
      title: '操作系统',
      dataIndex: 'os_type',
      key: 'os_type',
      width: 100
    },
    {
      title: 'OpenStack ID',
      dataIndex: 'openstack_id',
      key: 'openstack_id',
      width: 120,
      ellipsis: true
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160
    }
  ];

  // 租户统计表格列定义
  const tenantStatsColumns = [
    { title: '租户名称', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: '虚拟机总数', dataIndex: 'total_vms', key: 'total_vms' },
    { title: '运行中', dataIndex: 'running_vms', key: 'running_vms' },
    { title: 'CPU总计', dataIndex: 'total_cpu', key: 'total_cpu', render: (cpu) => `${cpu}核` },
    { title: '内存总计', dataIndex: 'total_memory', key: 'total_memory', render: (mem) => `${mem}GB` },
    { title: '存储总计', dataIndex: 'total_storage', key: 'total_storage', render: (disk) => `${disk}GB` }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={<span><CloudOutlined /> 云资源管理</span>}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAllData}>全部刷新</Button>
          </Space>
        }
      >
        {overview && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}><Card><Statistic title="计算实例" value={overview.compute?.total_instances || 0} /></Card></Col>
              <Col span={6}><Card><Statistic title="运行中" value={overview.compute?.running_instances || 0} /></Card></Col>
              <Col span={6}><Card><Statistic title="镜像" value={overview.images?.total || 0} /></Card></Col>
              <Col span={6}><Card><Statistic title="网络" value={overview.networks?.total || 0} /></Card></Col>
            </Row>
            <Card title="实例状态分布" style={{ marginBottom: 24 }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}
        <Tabs>
          <TabPane tab={<span><DesktopOutlined /> 虚拟机管理</span>} key="vms">
            {vmOverview ? (
              <>
                {/* 虚拟机统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={4}>
                    <Card>
                      <Statistic
                        title="虚拟机总数"
                        value={vmOverview.total_vms || 0}
                        suffix="台"
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card>
                      <Statistic
                        title="运行中"
                        value={vmOverview.status_stats?.running || 0}
                        suffix="台"
                        valueStyle={{ color: VM_STATUS_COLORS.running }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card>
                      <Statistic
                        title="已停止"
                        value={vmOverview.status_stats?.stopped || 0}
                        suffix="台"
                        valueStyle={{ color: VM_STATUS_COLORS.stopped }}
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card>
                      <Statistic
                        title="CPU总计"
                        value={vmOverview.resource_totals?.cpu_cores || 0}
                        suffix="核"
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card>
                      <Statistic
                        title="内存总计"
                        value={vmOverview.resource_totals?.memory_gb || 0}
                        suffix="GB"
                      />
                    </Card>
                  </Col>
                  <Col span={4}>
                    <Card>
                      <Statistic
                        title="存储总计"
                        value={vmOverview.resource_totals?.storage_gb || 0}
                        suffix="GB"
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 虚拟机状态图表和刷新控制 */}
                <Card
                  title="虚拟机状态分布"
                  extra={
                    <Space>
                      <Tag color={autoRefresh ? 'green' : 'default'}>
                        {autoRefresh ? <SyncOutlined spin /> : <SyncOutlined />}
                        {autoRefresh ? ' 自动刷新中' : ' 已暂停'}
                      </Tag>
                      <Button
                        size="small"
                        icon={autoRefresh ? <StopOutlined /> : <PlayCircleOutlined />}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                      >
                        {autoRefresh ? '暂停刷新' : '开启刷新'}
                      </Button>
                      <Button size="small" icon={<ReloadOutlined />} onClick={fetchVMOverview}>
                        立即刷新
                      </Button>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        最后更新: {lastUpdate.toLocaleTimeString()}
                      </span>
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <VMStatusChart />
                </Card>

                {/* 租户虚拟机统计 */}
                <Card title="租户虚拟机统计" style={{ marginBottom: 16 }}>
                  <Table
                    dataSource={vmOverview.tenant_stats || []}
                    columns={tenantStatsColumns}
                    rowKey="tenant_id"
                    pagination={false}
                  />
                </Card>

                {/* 虚拟机列表 */}
                <Card title="虚拟机列表（最近50台）">
                  <Table
                    dataSource={vmOverview.virtual_machines || []}
                    columns={vmColumns}
                    rowKey="id"
                    scroll={{ x: 1500 }}
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                <p style={{ marginTop: 16 }}>加载虚拟机数据中...</p>
              </div>
            )}
          </TabPane>

          <TabPane tab="计算实例" key="1">
            <Table dataSource={servers} rowKey="id" loading={loading} columns={[
              { title: '名称', dataIndex: 'name' },
              { title: 'ID', dataIndex: 'id', ellipsis: true },
              { title: '状态', dataIndex: 'status' }
            ]} />
          </TabPane>
          <TabPane tab="镜像管理" key="2">
            <Table dataSource={images} rowKey="id" loading={loading} columns={[
              { title: '名称', dataIndex: 'name' },
              { title: 'ID', dataIndex: 'id', ellipsis: true }
            ]} />
          </TabPane>
          <TabPane tab="网络管理" key="3">
            <Table dataSource={networks} rowKey="id" loading={loading} columns={[
              { title: '名称', dataIndex: 'name' },
              { title: 'ID', dataIndex: 'id', ellipsis: true }
            ]} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default CloudResources;
