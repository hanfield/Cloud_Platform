import axios from 'axios';
import AdminResourceCreate from '../components/AdminResourceCreate';
import VMDetailModal from '../components/VMDetailModal';
import React, { useState, useEffect, Suspense } from 'react';
import { Card, Row, Col, Statistic, Tabs, Table, Button, message, Tag, Space, Spin, Typography, Input, Switch, Dropdown, Menu, Popconfirm, Modal, Form, InputNumber, Divider, Upload, Select, Skeleton } from 'antd';
import { CloudOutlined, ReloadOutlined, DesktopOutlined, SyncOutlined, PlayCircleOutlined, StopOutlined, DatabaseOutlined, CloudServerOutlined, ThunderboltOutlined, SearchOutlined, CloudSyncOutlined, DownOutlined, EyeOutlined, DeleteOutlined, UploadOutlined, EditOutlined, BellOutlined, WarningOutlined, GlobalOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import cloudService from '../services/cloudService';
import { getIPLocation } from '../services/geoService';

// Lazy load VMGlobe3D
const VMGlobe3D = React.lazy(() => import('../components/VMGlobe3D'));

const { Text } = Typography;

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
  const location = useLocation();
  const currentPath = location.pathname;

  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [servers, setServers] = useState([]);
  const [images, setImages] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [vmOverview, setVmOverview] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // 管理员资源创建模态框状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createType, setCreateType] = useState('system'); // 'system' or 'vm'

  // 虚拟机搜索状态
  const [vmSearchText, setVmSearchText] = useState('');

  // 虚拟机详情模态框状态
  const [selectedVm, setSelectedVm] = useState(null);
  const [vmDetailModalVisible, setVmDetailModalVisible] = useState(false);

  // Resize模态框状态
  const [resizeModalVisible, setResizeModalVisible] = useState(false);
  const [selectedVmForResize, setSelectedVmForResize] = useState(null);
  const [resizeForm] = Form.useForm();

  // 镜像管理状态
  const [imageUploadModalVisible, setImageUploadModalVisible] = useState(false);
  const [imageEditModalVisible, setImageEditModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageForm] = Form.useForm();

  // 3D地球状态
  const [vmGlobeData, setVmGlobeData] = useState([]);
  const [globeLoading, setGlobeLoading] = useState(false);

  // 告警管理状态
  const [alertRules, setAlertRules] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertRuleModalVisible, setAlertRuleModalVisible] = useState(false);
  const [alertRuleForm] = Form.useForm();

  // 审计日志状态
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({});

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

  // 手动触发OpenStack同步
  const handleManualSync = async () => {
    try {
      setLoading(true);
      message.loading({ content: '正在同步OpenStack数据...', key: 'syncMsg' });

      const token = localStorage.getItem('access_token');
      await axios.post('/api/information-systems/sync_openstack/', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      message.success({ content: '同步完成', key: 'syncMsg' });
      // 同步完成后刷新数据
      await fetchVMOverview();
      await fetchAllData();
    } catch (error) {
      console.error('同步失败:', error);
      message.error({ content: `同步失败: ${error.response?.data?.message || error.message}`, key: 'syncMsg' });
    } finally {
      setLoading(false);
    }
  };

  // 处理虚拟机删除
  const handleDeleteVM = async (vmId) => {
    try {
      await cloudService.deleteVirtualMachine(vmId);
      message.success('虚拟机删除成功');
      fetchAllData();
    } catch (error) {
      message.error(`删除失败: ${error.message || '未知错误'}`);
    }
  };

  const handleOpenResizeModal = (vm) => {
    setSelectedVmForResize(vm);
    resizeForm.setFieldsValue({
      cpu_cores: vm.cpu_cores,
      memory_gb: vm.memory_gb,
      disk_gb: vm.disk_gb
    });
    setResizeModalVisible(true);
  };

  const handleResizeVM = async () => {
    try {
      const values = await resizeForm.validateFields();
      await cloudService.resizeVirtualMachine(selectedVmForResize.id, values);
      message.success('虚拟机配置调整成功');
      setResizeModalVisible(false);
      resizeForm.resetFields();
      setSelectedVmForResize(null);
      fetchAllData();
    } catch (error) {
      message.error(`配置调整失败: ${error.message || '未知错误'}`);
    }
  };

  //镜像管理处理函数
  const handleUploadImage = async () => {
    try {
      const values = await imageForm.validateFields();
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('disk_format', values.disk_format || 'qcow2');
      formData.append('min_disk', values.min_disk || 0);
      formData.append('min_ram', values.min_ram || 0);
      if (values.file && values.file.length > 0) {
        formData.append('file', values.file[0].originFileObj);
      }

      await cloudService.createImage(formData);
      message.success('镜像上传成功');
      setImageUploadModalVisible(false);
      imageForm.resetFields();
      fetchAllData();
    } catch (error) {
      message.error(`上传失败: ${error.message || '未知错误'}`);
    }
  };

  const handleEditImage = async () => {
    try {
      const values = await imageForm.validateFields();
      await cloudService.updateImage(selectedImage.id, values);
      message.success('镜像更新成功');
      setImageEditModalVisible(false);
      imageForm.resetFields();
      setSelectedImage(null);
      fetchAllData();
    } catch (error) {
      message.error(`更新失败: ${error.message || '未知错误'}`);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await cloudService.deleteImage(imageId);
      message.success('镜像删除成功');
      fetchAllData();
    } catch (error) {
      message.error(`删除失败: ${error.message || '未知错误'}`);
    }
  };

  // 告警管理函数
  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };
      const [rulesRes, historyRes] = await Promise.all([
        axios.get('/api/monitoring/alert-rules/', { headers }),
        axios.get('/api/monitoring/alert-history/', { headers })
      ]);
      setAlertRules(rulesRes.data || []);
      setAlertHistory(historyRes.data || []);
    } catch (error) {
      console.error('获取告警数据失败:', error);
      message.error('获取告警数据失败');
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleCreateAlertRule = async () => {
    try {
      const values = await alertRuleForm.validateFields();
      const token = localStorage.getItem('access_token');
      await axios.post('/api/monitoring/alert-rules/', values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('告警规则创建成功');
      setAlertRuleModalVisible(false);
      alertRuleForm.resetFields();
      fetchAlerts();
    } catch (error) {
      message.error(`创建失败: ${error.response?.data?.message || '未知错误'}`);
    }
  };

  const handleDeleteAlertRule = async (ruleId) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`/api/monitoring/alert-rules/${ruleId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('告警规则删除成功');
      fetchAlerts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 审计日志函数
  const fetchAuditLogs = async (filters = {}) => {
    setAuditLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user', filters.user_id);
      if (filters.action_type) params.append('action_type', filters.action_type);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.start_date) params.append('created_at__gte', filters.start_date);
      if (filters.end_date) params.append('created_at__lte', filters.end_date);

      const token = localStorage.getItem('access_token');
      const response = await axios.get(`/api/monitoring/activities/?${params.toString()}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuditLogs(response.data.results || response.data || []);
    } catch (error) {
      console.error('获取审计日志失败:', error);
      message.error('获取审计日志失败');
    } finally {
      setAuditLogsLoading(false);
    }
  };



  // 准备3D地球数据（添加地理位置信息）
  const prepareGlobeData = async (vms) => {
    console.log('=== 开始准备3D地球数据 ===');
    console.log('虚拟机总数:', vms?.length);

    if (!vms || vms.length === 0) {
      console.log('没有虚拟机数据');
      setVmGlobeData([]);
      return;
    }

    setGlobeLoading(true);

    try {
      // 取前50个VM（避免API限流）
      const vmsToProcess = vms.slice(0, 50);
      console.log('准备处理VM数量:', vmsToProcess.length);

      // 先打印第一个VM的数据结构
      if (vmsToProcess.length > 0) {
        console.log('第一个VM数据示例:', vmsToProcess[0]);
      }

      const enrichedVMs = await Promise.all(
        vmsToProcess.map(async (vm, index) => {
          // 尝试多个可能的IP字段名
          const ip = vm.ip_address || vm.ip || vm.fixed_ip || vm.floating_ip;

          if (ip && ip !== '-' && ip !== 'N/A' && ip !== '') {
            try {
              console.log(`[${index + 1}/${vmsToProcess.length}] 查询IP: ${ip}`);
              const location = await getIPLocation(ip);

              if (location) {
                console.log(`✓ IP ${ip} 定位成功:`, location.city, location.country);
                return {
                  ...vm,
                  latitude: location.lat,
                  longitude: location.lon,
                  city: location.city,
                  country: location.country
                };
              } else {
                console.log(`✗ IP ${ip} 定位失败`);
              }
            } catch (error) {
              console.error(`获取IP ${ip} 位置失败:`, error);
            }
          } else {
            console.log(`VM ${vm.name || index} 没有有效IP地址:`, ip);
          }
          return vm;
        })
      );

      const validVMs = enrichedVMs.filter(vm => vm.latitude && vm.longitude);
      console.log('有地理位置的VM数量:', validVMs.length);
      console.log('有地理位置的VM:', validVMs);

      setVmGlobeData(validVMs);
    } catch (error) {
      console.error('准备地球数据失败:', error);
      message.error('加载地理位置数据失败: ' + error.message);
    } finally {
      setGlobeLoading(false);
    }
  };

  // 监听vmOverview变化，更新3D地球数据
  useEffect(() => {
    // Only prepare globe data if we are on the globe view
    if (currentPath.includes('/globe') && vmOverview?.virtual_machines) {
      console.log('vmOverview.virtual_machines 更新，触发地球数据准备');
      prepareGlobeData(vmOverview.virtual_machines);
    } else {
      console.log('跳过地球数据准备: 不在地球视图或无数据');
    }
  }, [vmOverview, currentPath]);

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
      title: '运行时长',
      dataIndex: 'uptime',
      key: 'uptime',
      width: 120
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
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedVm(record);
              setVmDetailModalVisible(true);
            }}
          >
            详情
          </Button>
          {record.status === 'stopped' && (
            <Button
              size="small"
              icon={<DesktopOutlined />}
              onClick={() => handleOpenResizeModal(record)}
            >
              调整配置
            </Button>
          )}
          <Popconfirm
            title="确定删除此虚拟机吗？"
            description="删除后数据将无法恢复，请谨慎操作"
            onConfirm={() => handleDeleteVM(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
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

  // 虚拟机列表过滤
  const getFilteredVMs = () => {
    if (!vmOverview || !vmOverview.virtual_machines) return [];

    const vms = vmOverview.virtual_machines;
    if (!vmSearchText) return vms;

    const searchLower = vmSearchText.toLowerCase();
    return vms.filter(vm =>
      (vm.name && vm.name.toLowerCase().includes(searchLower)) ||
      (vm.tenant_name && vm.tenant_name.toLowerCase().includes(searchLower)) ||
      (vm.system_name && vm.system_name.toLowerCase().includes(searchLower)) ||
      (vm.ip_address && vm.ip_address.toLowerCase().includes(searchLower))
    );
  };

  // 快捷操作
  const quickActions = [
    {
      title: '为租户建系统',
      icon: <DatabaseOutlined />,
      color: '#722ed1',
      onClick: () => {
        setCreateType('system');
        setCreateModalVisible(true);
      }
    },
    {
      title: '为租户建VM',
      icon: <CloudServerOutlined />,
      color: '#13c2c2',
      onClick: () => {
        setCreateType('vm');
        setCreateModalVisible(true);
      }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ padding: '24px' }}>
        <div>
          {/* 隐藏顶部统计和快捷操作
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
        */}

          {(currentPath.includes('/vms') || currentPath === '/cloud-resources' || currentPath === '/cloud-resources/') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                  <DesktopOutlined /> 虚拟机管理
                </div>
                <Space>
                  <Button
                    type="primary"
                    icon={<DatabaseOutlined />}
                    style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                    onClick={() => {
                      setCreateType('system');
                      setCreateModalVisible(true);
                    }}
                  >
                    为租户建系统
                  </Button>
                  <Button
                    type="primary"
                    icon={<CloudServerOutlined />}
                    style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                    onClick={() => {
                      setCreateType('vm');
                      setCreateModalVisible(true);
                    }}
                  >
                    为租户建VM
                  </Button>
                </Space>
              </div>
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
                        <Space style={{ marginRight: 16 }}>
                          <Switch
                            checked={autoRefresh}
                            onChange={setAutoRefresh}
                            checkedChildren="自动刷新"
                            unCheckedChildren="自动刷新"
                          />
                        </Space>

                        <Dropdown.Button
                          type="primary"
                          icon={<DownOutlined />}
                          menu={{
                            items: [
                              {
                                key: 'sync',
                                label: '从 OpenStack 同步',
                                icon: <CloudSyncOutlined />,
                                onClick: handleManualSync
                              }
                            ]
                          }}
                          onClick={fetchVMOverview}
                          loading={loading}
                        >
                          <ReloadOutlined /> 立即刷新
                        </Dropdown.Button>

                        <span style={{ fontSize: '12px', color: '#999', marginLeft: 8 }}>
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
                  <Card
                    title="虚拟机列表（最近50台）"
                    extra={
                      <Input
                        placeholder="搜索虚拟机名称、租户、系统或IP"
                        prefix={<SearchOutlined />}
                        value={vmSearchText}
                        onChange={(e) => setVmSearchText(e.target.value)}
                        allowClear
                        style={{ width: 300 }}
                      />
                    }
                  >
                    <Table
                      dataSource={getFilteredVMs()}
                      columns={vmColumns}
                      rowKey="id"
                      scroll={{ x: 1500 }}
                      pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 台虚拟机` }}
                    />
                  </Card>
                </>
              ) : (
                <div style={{ padding: '24px' }}>
                  <Skeleton active paragraph={{ rows: 10 }} />
                </div>
              )}
            </motion.div>
          )}

          {currentPath.includes('/instances') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                <CloudServerOutlined /> 计算实例
              </div>
              <Table dataSource={servers} rowKey="id" loading={loading} columns={[
                { title: '名称', dataIndex: 'name' },
                { title: 'ID', dataIndex: 'id', ellipsis: true },
                { title: '状态', dataIndex: 'status' }
              ]} />
            </motion.div>
          )}

          {currentPath.includes('/images') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                <DatabaseOutlined /> 镜像管理
              </div>
              <Space style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setImageUploadModalVisible(true)}
                >
                  上传镜像
                </Button>
              </Space>
              <Table
                dataSource={images}
                rowKey="id"
                loading={loading}
                columns={[
                  { title: '名称', dataIndex: 'name', key: 'name' },
                  { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
                  { title: '格式', dataIndex: 'disk_format', key: 'disk_format' },
                  {
                    title: '状态', dataIndex: 'status', key: 'status',
                    render: (status) => <Tag color={status === 'active' ? 'green' : 'orange'}>{status}</Tag>
                  },
                  { title: '最小磁盘(GB)', dataIndex: 'min_disk', key: 'min_disk' },
                  { title: '最小内存(MB)', dataIndex: 'min_ram', key: 'min_ram' },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                      <Space>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setSelectedImage(record);
                            imageForm.setFieldsValue({
                              name: record.name,
                              min_disk: record.min_disk,
                              min_ram: record.min_ram
                            });
                            setImageEditModalVisible(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="确定删除此镜像吗？"
                          description="删除后无法恢复"
                          onConfirm={() => handleDeleteImage(record.id)}
                          okText="确定"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <Button size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
              />
            </motion.div>
          )}

          {currentPath.includes('/networks') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                <GlobalOutlined /> 网络管理
              </div>
              <Table dataSource={networks} rowKey="id" loading={loading} columns={[
                { title: '名称', dataIndex: 'name' },
                { title: 'ID', dataIndex: 'id', ellipsis: true }
              ]} />
            </motion.div>
          )}

          {currentPath.includes('/globe') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                <EnvironmentOutlined /> 3D地图
              </div>
              <Suspense fallback={<Skeleton active paragraph={{ rows: 10 }} />}>
                <VMGlobe3D vmData={vmGlobeData} loading={globeLoading} />
              </Suspense>
            </motion.div>
          )}

          {currentPath.includes('/alerts') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                <BellOutlined /> 告警管理
              </div>
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<BellOutlined />}
                    onClick={() => {
                      alertRuleForm.resetFields();
                      setAlertRuleModalVisible(true);
                    }}
                  >
                    创建告警规则
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchAlerts}
                  >
                    刷新
                  </Button>
                </Space>

                <h3>告警规则</h3>
                <Table
                  dataSource={alertRules}
                  rowKey="id"
                  loading={alertsLoading}
                  columns={[
                    { title: '规则名称', dataIndex: 'name' },
                    {
                      title: '监控指标',
                      dataIndex: 'metric_type',
                      render: (type) => {
                        const typeMap = {
                          cpu: 'CPU使用率',
                          memory: '内存使用率',
                          disk: '磁盘使用率',
                          network_in: '网络入流量',
                          network_out: '网络出流量'
                        };
                        return typeMap[type] || type;
                      }
                    },
                    {
                      title: '阈值条件',
                      render: (_, record) => `${record.operator === 'gt' ? '>' : '<'} ${record.threshold}%`
                    },
                    { title: '持续时间', dataIndex: 'duration', render: (min) => `${min}分钟` },
                    {
                      title: '关联VM',
                      dataIndex: 'virtual_machine_name',
                      render: (name) => name || <Tag>全局规则</Tag>
                    },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      render: (enabled) => <Tag color={enabled ? 'green' : 'red'}>{enabled ? '启用' : '禁用'}</Tag>
                    },
                    {
                      title: '操作',
                      render: (_, record) => (
                        <Popconfirm
                          title="确定删除此告警规则吗？"
                          onConfirm={() => handleDeleteAlertRule(record.id)}
                        >
                          <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                        </Popconfirm>
                      )
                    }
                  ]}
                />

                <Divider />

                <h3>告警历史</h3>
                <Table
                  dataSource={alertHistory}
                  rowKey="id"
                  loading={alertsLoading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: (status) => (
                        <Tag icon={<WarningOutlined />} color={status === 'active' ? 'error' : 'success'}>
                          {status === 'active' ? '触发中' : '已恢复'}
                        </Tag>
                      )
                    },
                    { title: '告警规则', dataIndex: 'rule_name' },
                    { title: '虚拟机', dataIndex: 'virtual_machine_name' },
                    { title: '告警内容', dataIndex: 'message' },
                    { title: '触发值', dataIndex: 'metric_value', render: (val) => `${val}%` },
                    { title: '开始时间', dataIndex: 'started_at', render: (time) => new Date(time).toLocaleString() },
                    {
                      title: '恢复时间',
                      dataIndex: 'resolved_at',
                      render: (time) => time ? new Date(time).toLocaleString() : '-'
                    }
                  ]}
                />
              </div>
            </motion.div>
          )}

          {currentPath.includes('/audit') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                <SearchOutlined /> 操作审计
              </div>
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={() => fetchAuditLogs(auditFilters)}
                  >
                    查询
                  </Button>
                  <Select
                    placeholder="操作类型"
                    style={{ width: 150 }}
                    allowClear
                    onChange={(value) => setAuditFilters({ ...auditFilters, action_type: value })}
                  >
                    <Select.Option value="create">创建</Select.Option>
                    <Select.Option value="update">更新</Select.Option>
                    <Select.Option value="delete">删除</Select.Option>
                    <Select.Option value="start">启动</Select.Option>
                    <Select.Option value="stop">停止</Select.Option>
                    <Select.Option value="resize">调整配置</Select.Option>
                    <Select.Option value="snapshot">创建快照</Select.Option>
                  </Select>
                  <Select
                    placeholder="资源类型"
                    style={{ width: 150 }}
                    allowClear
                    onChange={(value) => setAuditFilters({ ...auditFilters, resource_type: value })}
                  >
                    <Select.Option value="vm">虚拟机</Select.Option>
                    <Select.Option value="image">镜像</Select.Option>
                    <Select.Option value="snapshot">快照</Select.Option>
                    <Select.Option value="alert_rule">告警规则</Select.Option>
                    <Select.Option value="tenant">租户</Select.Option>
                    <Select.Option value="user">用户</Select.Option>
                  </Select>
                </Space>

                <Table
                  dataSource={auditLogs}
                  rowKey="id"
                  loading={auditLogsLoading}
                  pagination={{ pageSize: 20 }}
                  columns={[
                    {
                      title: '时间',
                      dataIndex: 'created_at',
                      render: (time) => new Date(time).toLocaleString(),
                      width: 180
                    },
                    {
                      title: '用户',
                      dataIndex: 'username',
                      render: (name) => name || '系统',
                      width: 120
                    },
                    {
                      title: '操作',
                      dataIndex: 'action_type_display',
                      width: 100
                    },
                    {
                      title: '资源类型',
                      dataIndex: 'resource_type_display',
                      width: 100
                    },
                    {
                      title: '资源名称',
                      dataIndex: 'resource_name',
                      render: (name) => name || '-',
                      width: 150
                    },
                    {
                      title: '描述',
                      dataIndex: 'description',
                      ellipsis: true
                    },
                    {
                      title: '状态',
                      dataIndex: 'status_display',
                      width: 80,
                      render: (text, record) => (
                        <Tag color={record.status === 'success' ? 'green' : 'red'}>
                          {text}
                        </Tag>
                      )
                    },
                    {
                      title: 'IP地址',
                      dataIndex: 'ip_address',
                      width: 140
                    }
                  ]}
                  expandable={{
                    expandedRowRender: (record) => (
                      <div style={{ padding: '10px', background: '#f5f5f5' }}>
                        <p><strong>请求路径:</strong> {record.request_path || '-'}</p>
                        <p><strong>请求方法:</strong> {record.request_method || '-'}</p>
                        <p><strong>用户代理:</strong> {record.user_agent || '-'}</p>
                        {record.changes && (
                          <div>
                            <strong>变更详情:</strong>
                            <pre style={{ background: '#fff', padding: '10px', marginTop: '5px' }}>
                              {JSON.stringify(record.changes, null, 2)}
                            </pre>
                          </div>
                        )}
                        {record.error_message && (
                          <p style={{ color: 'red' }}>
                            <strong>错误信息:</strong> {record.error_message}
                          </p>
                        )}
                      </div>
                    )
                  }}
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <AdminResourceCreate
        visible={createModalVisible}
        type={createType}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          message.success('资源创建成功');
          fetchAllData(); // Refresh data
        }}
      />

      <VMDetailModal
        visible={vmDetailModalVisible}
        vm={selectedVm}
        onClose={() => {
          setVmDetailModalVisible(false);
          setSelectedVm(null);
        }}
        onRefresh={fetchVMOverview}
      />

      {/* 虚拟机配置调整模态框 */}
      <Modal
        title="调整虚拟机配置"
        open={resizeModalVisible}
        onOk={handleResizeVM}
        onCancel={() => {
          setResizeModalVisible(false);
          resizeForm.resetFields();
          setSelectedVmForResize(null);
        }}
        okText="确认调整"
        cancelText="取消"
      >
        {selectedVmForResize && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>虚拟机名称：</strong>{selectedVmForResize.name}</p>
            <p><strong>当前配置：</strong>{selectedVmForResize.cpu_cores}核 / {selectedVmForResize.memory_gb}GB / {selectedVmForResize.disk_gb}GB</p>
            <Divider />
          </div>
        )}
        <Form form={resizeForm} layout="vertical">
          <Form.Item
            label="CPU (核数)"
            name="cpu_cores"
            rules={[{ required: true, message: '请输入CPU核数' }]}
          >
            <InputNumber min={1} max={64} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="内存 (GB)"
            name="memory_gb"
            rules={[{ required: true, message: '请输入内存大小' }]}
          >
            <InputNumber min={1} max={256} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="磁盘 (GB)"
            name="disk_gb"
            rules={[{ required: true, message: '请输入磁盘大小' }]}
          >
            <InputNumber min={10} max={2000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
            ⚠️ 注意：调整配置需要虚拟机处于停止状态。调整完成后请手动启动虚拟机。
          </p>
        </div>
      </Modal>

      {/* 镜像上传模态框 */}
      <Modal
        title="上传镜像"
        open={imageUploadModalVisible}
        onOk={handleUploadImage}
        onCancel={() => {
          setImageUploadModalVisible(false);
          imageForm.resetFields();
        }}
        okText="上传"
        cancelText="取消"
      >
        <Form form={imageForm} layout="vertical">
          <Form.Item
            label="镜像名称"
            name="name"
            rules={[{ required: true, message: '请输入镜像名称' }]}
          >
            <Input placeholder="例如: ubuntu-22.04" />
          </Form.Item>
          <Form.Item
            label="磁盘格式"
            name="disk_format"
            initialValue="qcow2"
          >
            <Select>
              <Select.Option value="qcow2">QCOW2</Select.Option>
              <Select.Option value="raw">RAW</Select.Option>
              <Select.Option value="iso">ISO</Select.Option>
              <Select.Option value="vmdk">VMDK</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="最小磁盘(GB)"
            name="min_disk"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="最小内存(MB)"
            name="min_ram"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="镜像文件"
            name="file"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList;
            }}
          >
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              accept=".qcow2,.raw,.iso,.img"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* 镜像编辑模态框 */}
      <Modal
        title="编辑镜像"
        open={imageEditModalVisible}
        onOk={handleEditImage}
        onCancel={() => {
          setImageEditModalVisible(false);
          imageForm.resetFields();
          setSelectedImage(null);
        }}
        okText="保存"
        cancelText="取消"
      >
        {selectedImage && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>镜像ID：</strong>{selectedImage.id}</p>
            <Divider />
          </div>
        )}
        <Form form={imageForm} layout="vertical">
          <Form.Item
            label="镜像名称"
            name="name"
            rules={[{ required: true, message: '请输入镜像名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="最小磁盘(GB)"
            name="min_disk"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="最小内存(MB)"
            name="min_ram"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 告警规则创建模态框 */}
      <Modal
        title="创建告警规则"
        open={alertRuleModalVisible}
        onOk={handleCreateAlertRule}
        onCancel={() => {
          setAlertRuleModalVisible(false);
          alertRuleForm.resetFields();
        }}
        okText="创建"
        cancelText="取消"
      >
        <Form form={alertRuleForm} layout="vertical">
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如: CPU高负载告警" />
          </Form.Item>
          <Form.Item
            label="监控指标"
            name="metric_type"
            rules={[{ required: true, message: '请选择监控指标' }]}
          >
            <Select placeholder="选择指标">
              <Select.Option value="cpu">CPU使用率</Select.Option>
              <Select.Option value="memory">内存使用率</Select.Option>
              <Select.Option value="disk">磁盘使用率</Select.Option>
              <Select.Option value="network_in">网络入流量</Select.Option>
              <Select.Option value="network_out">网络出流量</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="比较操作符"
            name="operator"
            initialValue="gt"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="gt">大于 (&gt;)</Select.Option>
              <Select.Option value="lt">小于 (&lt;)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="阈值(%)"
            name="threshold"
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="例如: 80" />
          </Form.Item>
          <Form.Item
            label="持续时间(分钟)"
            name="duration"
            initialValue={5}
            rules={[{ required: true, message: '请输入持续时间' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="关联虚拟机(可选)"
            name="virtual_machine"
            help="不选则为全局规则，对所有虚拟机生效"
          >
            <Select
              showSearch
              allowClear
              placeholder="选择虚拟机"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {vmOverview?.virtual_machines?.map(vm => (
                <Select.Option key={vm.id} value={vm.id}>{vm.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="启用规则"
            name="enabled"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div >
  );
};

export default CloudResources;

