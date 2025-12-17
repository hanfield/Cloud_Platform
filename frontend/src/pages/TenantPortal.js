import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Button, Space, Tag, Descriptions, message, Modal, Form, Input, Select, Statistic, Divider, InputNumber, TimePicker, Progress, Popconfirm } from 'antd';
import { UserOutlined, DesktopOutlined, ShoppingOutlined, PlusOutlined, PoweroffOutlined, PlayCircleOutlined, StopOutlined, TeamOutlined, EyeOutlined, SyncOutlined, ReloadOutlined, ThunderboltOutlined, DatabaseOutlined, CloudServerOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import tenantPortalService from '../services/tenantPortalService';
import cloudService from '../services/cloudService';
import api from '../services/api';
import VMDetailModal from '../components/VMDetailModal';
import VMCreateWizard from '../components/VMCreateWizard';
import VMEditModal from '../components/VMEditModal';
import moment from 'moment';
import { useFlavors } from '../contexts/ResourceCacheContext';
import useVMStatusWebSocket from '../hooks/useVMStatusWebSocket';


const { Option } = Select;

const TenantPortal = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [systems, setSystems] = useState([]);
  // VM 数据现在通过 orders.vm_resources 从数据库获取，不再直接调用 OpenStack
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState(null);
  const [products, setProducts] = useState([]);
  const [systemModalVisible, setSystemModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [vmModalVisible, setVmModalVisible] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [availabilityZones, setAvailabilityZones] = useState([]);
  const [vmDetailModalVisible, setVmDetailModalVisible] = useState(false);
  const [selectedVm, setSelectedVm] = useState(null);
  const [form] = Form.useForm();
  const [productForm] = Form.useForm();
  const [vmForm] = Form.useForm();
  const [resizeForm] = Form.useForm();
  const [resizeModalVisible, setResizeModalVisible] = useState(false);
  const [selectedVmForResize, setSelectedVmForResize] = useState(null);
  const [vmOperations, setVmOperations] = useState(new Set()); // 跟踪正在操作的VM
  const [vmEditModalVisible, setVmEditModalVisible] = useState(false);
  const [selectedVmForEdit, setSelectedVmForEdit] = useState(null);

  // 使用缓存 hook 获取 flavors
  const { flavors } = useFlavors();

  // 根据路由确定当前标签页
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    if (path === '/tenant-info') return 'info';
    if (path === '/tenant-systems') return 'systems';
    if (path === '/tenant-products') return 'products';
    if (path === '/tenant-orders') return 'orders';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());


  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location.pathname]);

  useEffect(() => {
    fetchAllData();
  }, []);

  // 自动刷新功能 - 每5秒刷新一次
  useEffect(() => {
    let refreshInterval;
    if (autoRefresh && activeTab === 'systems') {  // 只在systems标签页刷新
      refreshInterval = setInterval(() => {
        fetchAllData();
        setLastUpdate(new Date());
      }, 5000); // 5秒刷新一次
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh, activeTab]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const profileRes = await tenantPortalService.getTenantProfile();
      setProfile(profileRes);

      const systemsRes = await tenantPortalService.getSystemsOverview();
      setSystems(systemsRes.systems || []);

      // 不再直接调用 OpenStack API，改为使用数据库数据（通过 orders.vm_resources）
      // 这样更安全，租户用户不需要直接访问 OpenStack
      // VMs 数据将从 ordersRes.orders 中的 vm_resources 获取


      const ordersRes = await tenantPortalService.getTenantOrders();
      // Deduplicate orders by system_id to prevent duplicate display
      const uniqueOrders = [];
      const seenSystemIds = new Set();
      (ordersRes.orders || []).forEach(order => {
        if (!seenSystemIds.has(order.system_id)) {
          seenSystemIds.add(order.system_id);
          uniqueOrders.push(order);
        }
      });
      setOrders(uniqueOrders);

      const subsRes = await tenantPortalService.getTenantSubscriptions();
      setSubscriptions(subsRes);
      const productsRes = await tenantPortalService.getAvailableProducts();
      setProducts(productsRes.products || []);
    } catch (error) {
      message.error('获取数据失败: ' + error.message);
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket 实时状态更新 - 当其他用户操作 VM 时自动刷新
  // 必须在 fetchAllData 定义之后使用，避免 stale closure
  useEffect(() => {
    // 使用 effect 而不是 useCallback 来避免依赖问题
  }, []);

  const handleWebSocketUpdate = useCallback((data) => {
    console.log('收到 WebSocket VM 状态更新:', data);
    // 刷新数据以显示最新状态
    fetchAllData();
    setLastUpdate(new Date());
  }, [fetchAllData]);

  useVMStatusWebSocket(handleWebSocketUpdate);

  const handleControlResource = async (resourceId, resourceType, action) => {
    // 检查是否已有操作在进行
    if (vmOperations.has(resourceId)) {
      message.warning('该虚拟机正在执行操作，请等待完成');
      return;
    }

    // 标记VM为操作中
    setVmOperations(prev => new Set(prev).add(resourceId));
    const actionName = action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启';
    const hide = message.loading(`正在${actionName}虚拟机...`, 0);

    try {
      // 通过后端代理 API 控制资源（不再直接调用 OpenStack）
      // 后端会处理权限验证、并发控制、操作日志等
      await tenantPortalService.controlResource({
        resource_id: resourceId,
        resource_type: resourceType,
        action: action
      });

      hide();
      message.success(`${actionName}成功`);

      // 操作成功：解锁按钮
      setVmOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(resourceId);
        return newSet;
      });

      fetchAllData();
    } catch (error) {
      hide();
      // 操作失败：解锁按钮
      setVmOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(resourceId);
        return newSet;
      });

      // 处理并发冲突错误 (409 Conflict)
      if (error.response?.status === 409) {
        message.warning(error.response?.data?.error || '该虚拟机正在执行其他操作，请稍后重试');
      } else {
        message.error(`${actionName}失败: ${error.response?.data?.error || error.message || '未知错误'}`);
      }
    }
  };


  const handleDeleteVM = async (vmId) => {
    // 检查是否已有操作在进行
    if (vmOperations.has(vmId)) {
      message.warning('该虚拟机正在执行操作，请等待完成');
      return;
    }

    // 标记VM为操作中
    setVmOperations(prev => new Set(prev).add(vmId));
    const hide = message.loading('正在删除虚拟机...', 0);

    try {
      // 调用专门的删除虚拟机 API
      await tenantPortalService.deleteVirtualMachine(vmId);
      hide();
      message.success('虚拟机删除成功');

      // 操作成功：解锁按钮
      setVmOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(vmId);
        return newSet;
      });

      fetchAllData();
    } catch (error) {
      hide();
      // 操作失败：解锁按钮
      setVmOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(vmId);
        return newSet;
      });

      if (error.response?.status === 409) {
        message.warning(error.response?.data?.error || '该虚拟机正在执行其他操作，请稍后重试');
      } else {
        message.error(`删除失败: ${error.response?.data?.error || error.message || '未知错误'}`);
      }
    }
  };


  const handleOpenResizeModal = (vm) => {
    setSelectedVmForResize(vm);
    resizeForm.resetFields();
    setResizeModalVisible(true);
  };

  const handleResizeVM = async () => {
    const vmId = selectedVmForResize?.id;
    const openstackId = selectedVmForResize?.openstack_id || selectedVmForResize?.id;

    // 检查是否已有操作在进行
    if (vmId && vmOperations.has(vmId)) {
      message.warning('该虚拟机正在执行操作，请等待完成');
      return;
    }

    try {
      const values = await resizeForm.validateFields();

      // 标记VM为操作中
      if (vmId) {
        setVmOperations(prev => new Set(prev).add(vmId));
      }
      const hide = message.loading('正在提交resize请求...', 0);

      // 使用 cloudService 调用 OpenStack resize API
      await cloudService.resizeServer(openstackId, values.new_flavor_id, false);

      hide();
      message.success('resize请求已提交，请等待状态变为VERIFY_RESIZE后确认或回滚');
      setResizeModalVisible(false);
      resizeForm.resetFields();
      setSelectedVmForResize(null);

      // 操作成功：解锁按钮
      if (vmId) {
        setVmOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(vmId);
          return newSet;
        });
      }

      fetchAllData();
    } catch (error) {
      // 操作失败：解锁按钮
      if (vmId) {
        setVmOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(vmId);
          return newSet;
        });
      }
      message.error(`配置调整失败: ${error.message || '未知错误'}`);
    }
  };

  const handleCreateSystem = async () => {
    try {
      const values = await form.validateFields();
      await tenantPortalService.createInformationSystem(values);
      message.success('信息系统创建成功');
      setSystemModalVisible(false);
      form.resetFields();
      fetchAllData();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleSubscribeProduct = async () => {
    try {
      const values = await productForm.validateFields();
      await tenantPortalService.subscribeProduct(values);
      message.success('产品订阅成功');
      setProductModalVisible(false);
      productForm.resetFields();
      fetchAllData();
    } catch (error) {
      message.error('订阅失败');
    }
  };

  const handleCreateVM = async () => {
    try {
      const values = await vmForm.validateFields();

      // 处理时间字段
      const vmData = {
        ...values,
        system_id: values.system_id || selectedSystemId,
        runtime_start: values.runtime_start ? values.runtime_start.format('HH:mm') : null,
        runtime_end: values.runtime_end ? values.runtime_end.format('HH:mm') : null,
      };

      await tenantPortalService.createVirtualMachine(vmData);
      message.success('虚拟机创建成功');
      setVmModalVisible(false);
      vmForm.resetFields();
      setSelectedSystemId(null);
      fetchAllData();
    } catch (error) {
      message.error('创建虚拟机失败: ' + (error.message || '未知错误'));
    }
  };

  const openCreateVMModal = async (systemId) => {
    setSelectedSystemId(systemId);
    setVmModalVisible(true);

    // 获取可用区列表
    try {
      const response = await tenantPortalService.getAvailabilityZones();
      setAvailabilityZones(response.zones || []);
    } catch (error) {
      console.error('获取可用区失败:', error);
      message.warning('获取可用区列表失败，请手动输入');
    }
  };

  // 计算虚拟机状态统计 - 使用数据库数据（通过 orders.vm_resources）
  const getVMStatusStats = () => {
    // 从所有订单的 vm_resources 中收集 VM 数据
    const allVMs = orders.flatMap(order => order.vm_resources || []);

    const stats = allVMs.reduce((acc, vm) => {
      // 处理数据库中的状态格式
      let status = vm.status?.toLowerCase() || 'unknown';
      // 标准化状态名称
      if (status === 'active') status = 'running';
      else if (status === 'shutoff') status = 'stopped';

      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // 状态映射和颜色
    const statusConfig = {
      'running': { label: '运行中', color: '#52c41a' },
      'stopped': { label: '已停止', color: '#ff4d4f' },
      'paused': { label: '已暂停', color: '#faad14' },
      'error': { label: '异常', color: '#f5222d' },
      'unknown': { label: '未知', color: '#d9d9d9' }
    };

    return Object.keys(stats).map(status => ({
      name: statusConfig[status]?.label || status,
      value: stats[status],
      status: status,
      color: statusConfig[status]?.color || '#d9d9d9'
    }));
  };


  // 虚拟机状态饼图组件
  const VMStatusChart = () => {
    const data = getVMStatusStats();
    const totalVMs = data.reduce((sum, item) => sum + item.value, 0);

    if (totalVMs === 0) {
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
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {data.map((item) => (
            <Col span={6} key={item.status}>
              <Card>
                <Statistic
                  title={item.name}
                  value={item.value}
                  suffix="台"
                  valueStyle={{ color: item.color }}
                />
              </Card>
            </Col>
          ))}
          <Col span={6}>
            <Card>
              <Statistic title="总计" value={totalVMs} suffix="台" />
            </Card>
          </Col>
        </Row>

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
      </div>
    );
  };

  // 租户信息标签页
  const renderTenantInfo = () => {
    if (!profile) return null;

    return (
      <div>
        <Card title={<><TeamOutlined /> 租户基本信息</>} style={{ marginBottom: 24 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="租户名称">{profile.name}</Descriptions.Item>
            <Descriptions.Item label="租户编码">{profile.code}</Descriptions.Item>
            <Descriptions.Item label="租户类型">{profile.tenant_type_display}</Descriptions.Item>
            <Descriptions.Item label="租户级别">{profile.level_display}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={profile.status === 'active' ? 'green' : 'red'}>{profile.status_display}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="联系人">{profile.contact_person}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{profile.contact_phone}</Descriptions.Item>
            <Descriptions.Item label="联系邮箱">{profile.contact_email}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{profile.address}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title={<><UserOutlined /> 干系人信息</>}>
          {profile.stakeholders && profile.stakeholders.length > 0 ? (
            <Table
              dataSource={profile.stakeholders}
              rowKey="id"
              pagination={false}
              columns={[
                { title: '姓名', dataIndex: 'name', key: 'name' },
                { title: '职位', dataIndex: 'position', key: 'position' },
                { title: '部门', dataIndex: 'department', key: 'department' },
                { title: '电话', dataIndex: 'phone', key: 'phone' },
                { title: '邮箱', dataIndex: 'email', key: 'email' },
                {
                  title: '类型',
                  dataIndex: 'stakeholder_type_display',
                  key: 'stakeholder_type',
                  render: (text) => <Tag color="blue">{text}</Tag>
                },
                {
                  title: '主要联系人',
                  dataIndex: 'is_primary',
                  key: 'is_primary',
                  render: (isPrimary) => isPrimary ? <Tag color="gold">是</Tag> : <Tag>否</Tag>
                }
              ]}
            />
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无干系人信息</p>
          )}
        </Card>
      </div>
    );
  };

  // 概览标签页
  const renderOverview = () => {
    return (
      <div>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable className="dashboard-card">
              <Statistic title="信息系统" value={systems.length} suffix="个" valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable className="dashboard-card">
              <Statistic title="产品订阅" value={subscriptions?.total_products || 0} suffix="个" valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable className="dashboard-card">
              <Statistic title="服务订阅" value={subscriptions?.total_services || 0} suffix="个" valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable className="dashboard-card">
              <Statistic title="运行中系统" value={systems.filter(s => s.status === 'running').length} suffix="个" valueStyle={{ color: '#722ed1' }} />
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
          style={{ marginBottom: 24, marginTop: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered={false}
                hoverable
                onClick={() => setSystemModalVisible(true)}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  border: '1px solid #722ed120',
                }}
                bodyStyle={{ padding: '24px 16px' }}
              >
                <div style={{ fontSize: 32, color: '#722ed1', marginBottom: 12 }}>
                  <DatabaseOutlined />
                </div>
                <span style={{ fontWeight: 500 }}>创建信息系统</span>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                bordered={false}
                hoverable
                onClick={() => {
                  if (systems.length === 0) {
                    message.warning('请先创建信息系统');
                    return;
                  }
                  openCreateVMModal(null);
                }}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  border: '1px solid #13c2c220',
                  marginTop: 0, // Added margin top as per instruction
                }}
                bodyStyle={{ padding: '24px 16px' }}
              >
                <div style={{ fontSize: 32, color: '#13c2c2', marginBottom: 12 }}>
                  <CloudServerOutlined />
                </div>
                <span style={{ fontWeight: 500 }}>创建虚拟机</span>
              </Card>
            </Col>
          </Row>
        </Card>

        <Divider />

        {/* 租户信息概要 */}
        {profile && (
          <Card title="租户信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2}>
              <Descriptions.Item label="租户名称">{profile.name}</Descriptions.Item>
              <Descriptions.Item label="租户类型">{profile.tenant_type_display}</Descriptions.Item>
              <Descriptions.Item label="联系人">{profile.contact_person}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{profile.contact_phone}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* 最近系统 */}
        <Card title="我的信息系统" extra={<Button type="link" onClick={() => setActiveTab('systems')}>查看全部</Button>}>
          <Table
            dataSource={systems.slice(0, 5)}
            rowKey="id"
            pagination={false}
            columns={[
              { title: '系统名称', dataIndex: 'name', key: 'name' },
              { title: '系统编码', dataIndex: 'code', key: 'code' },
              { title: '运行模式', dataIndex: 'operation_mode_display', key: 'operation_mode' },
              { title: '运行时长', dataIndex: 'running_time', key: 'running_time' },
              {
                title: '状态', dataIndex: 'status_display', key: 'status', render: (text, record) => (
                  <Tag color={record.status === 'running' ? 'green' : 'default'}>{text}</Tag>
                )
              }
            ]}
          />
        </Card>
      </div>
    );
  };

  const vmColumns = [
    { title: '虚拟机名称', dataIndex: 'name', key: 'name', sorter: (a, b) => (a.name || '').localeCompare(b.name || '') },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', sorter: (a, b) => (a.ip || '').localeCompare(b.ip || '') },
    { title: '数据中心', dataIndex: 'data_center_type_display', key: 'data_center_type', sorter: (a, b) => (a.data_center_type_display || '').localeCompare(b.data_center_type_display || '') },
    { title: '可用区', dataIndex: 'availability_zone', key: 'availability_zone', sorter: (a, b) => (a.availability_zone || '').localeCompare(b.availability_zone || '') },
    { title: '运行时长', dataIndex: 'uptime', key: 'uptime', sorter: (a, b) => (a.uptime || '').localeCompare(b.uptime || '') },
    { title: '操作系统', dataIndex: 'os_type', key: 'os_type', sorter: (a, b) => (a.os_type || '').localeCompare(b.os_type || '') },
    { title: '状态', dataIndex: 'status', key: 'status', sorter: (a, b) => (a.status || '').localeCompare(b.status || ''), render: (status, record) => <Tag color={status === 'running' ? 'green' : 'red'}>{record.status_display}</Tag> },
    {
      title: 'CPU',
      key: 'cpu',
      sorter: (a, b) => (a.flavor?.vcpus || a.cpu || 0) - (b.flavor?.vcpus || b.cpu || 0),
      render: (_, record) => {
        // OpenStack API 已经嵌入了完整的 flavor 对象，直接使用
        const vcpus = record.flavor?.vcpus;
        return vcpus ? `${vcpus}核` : (record.cpu ? `${record.cpu}核` : '-');
      }
    },
    {
      title: '内存',
      key: 'memory',
      sorter: (a, b) => (a.flavor?.ram || a.memory || 0) - (b.flavor?.ram || b.memory || 0),
      render: (_, record) => {
        const ram = record.flavor?.ram;
        return ram ? `${(ram / 1024).toFixed(1)}GB` : (record.memory ? `${record.memory}GB` : '-');
      }
    },
    {
      title: '磁盘',
      key: 'disk',
      sorter: (a, b) => (a.flavor?.disk || a.disk || 0) - (b.flavor?.disk || b.disk || 0),
      render: (_, record) => {
        const disk = record.flavor?.disk;
        return disk ? `${disk}GB` : (record.disk ? `${record.disk}GB` : '-');
      }
    },
    { title: '最新启动时间', dataIndex: 'last_start_time', key: 'last_start_time', sorter: (a, b) => (a.last_start_time || '').localeCompare(b.last_start_time || ''), render: (time) => time || '-' },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 280,
      render: (_, record) => {
        const isOperating = vmOperations.has(record.id);
        return (
          <Space wrap size="small">
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
            <Button
              size="small"
              icon={<EditOutlined />}
              style={{ color: '#13c2c2', borderColor: '#13c2c2' }}
              onClick={() => {
                setSelectedVmForEdit(record);
                setVmEditModalVisible(true);
              }}
            >
              编辑
            </Button>
            {record.status === 'running' ? (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleControlResource(record.id, 'vm', 'stop')}
                disabled={isOperating}
                loading={isOperating}
              >
                {isOperating ? '停止中' : '停止'}
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleControlResource(record.id, 'vm', 'start')}
                disabled={isOperating}
                loading={isOperating}
              >
                {isOperating ? '启动中' : '启动'}
              </Button>
            )}
            {record.status === 'stopped' && (
              <Button
                size="small"
                style={{ color: '#722ed1', borderColor: '#722ed1' }}
                icon={<DesktopOutlined />}
                onClick={() => handleOpenResizeModal(record)}
                disabled={isOperating}
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
              disabled={isOperating}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={isOperating}
                loading={isOperating}
              >
                {isOperating ? '删除中' : '删除'}
              </Button>
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  const productColumns = [
    { title: '产品名称', dataIndex: 'name', key: 'name' },
    { title: '产品类型', dataIndex: 'product_type_display', key: 'product_type' },
    { title: '子类别', dataIndex: 'subcategory', key: 'subcategory' },
    { title: '价格', dataIndex: 'base_price', key: 'base_price', render: (price) => `¥${price}` },
    { title: 'CPU', dataIndex: 'cpu_capacity', key: 'cpu', render: (cpu) => cpu ? `${cpu}核` : '-' },
    { title: '内存', dataIndex: 'memory_capacity', key: 'memory', render: (mem) => mem ? `${mem}GB` : '-' },
    { title: '存储', dataIndex: 'storage_capacity', key: 'storage', render: (storage) => storage ? `${storage}GB` : '-' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => { productForm.setFieldsValue({ product_id: record.id }); setProductModalVisible(true); }}>
          订阅
        </Button>
      )
    }
  ];

  // 我的系统标签页
  const renderSystems = () => {
    return (
      <div>
        {/* 虚拟机状态总览和刷新控制 */}
        <Card
          title="虚拟机状态总览"
          extra={
            <Space>
              <Tag color={autoRefresh ? 'green' : 'default'}>
                {autoRefresh ? <SyncOutlined spin /> : <SyncOutlined />}
                {autoRefresh ? ' 每5秒自动刷新' : ' 自动刷新已关闭'}
              </Tag>
              <Button
                size="small"
                icon={autoRefresh ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh ? '关闭后不再自动刷新数据' : '开启后每5秒自动刷新数据'}
              >
                {autoRefresh ? '关闭自动刷新' : '开启自动刷新'}
              </Button>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={fetchAllData}
                title="不等待自动更新，立即从服务器获取最新数据"
              >
                手动刷新
              </Button>
              <span style={{ fontSize: '12px', color: '#999' }}>
                上次更新: {lastUpdate.toLocaleTimeString()}
              </span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <VMStatusChart />
        </Card>

        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setSystemModalVisible(true)}>创建新系统</Button>
        </div>

        {/* 各系统的虚拟机列表 - 合并本地数据与 OpenStack 实时数据 */}
        {orders.map((order) => {
          // 使用从数据库同步的 vm_resources 数据
          // 不再直接调用 OpenStack API，所有数据通过后端同步到数据库
          const localVMs = order.vm_resources || [];

          // 直接使用数据库数据，添加必要的字段映射
          const displayVMs = localVMs.map(vm => ({
            ...vm,
            database_id: vm.id, // 本地数据库ID，用于快照、监控和操作功能
            ip: vm.ip || vm.ip_address || '-',
            status_display: vm.status === 'running' ? '运行中' :
              (vm.status === 'stopped' ? '已停止' :
                (vm.status === 'paused' ? '已暂停' :
                  (vm.status === 'error' ? '异常' : vm.status))),
            availability_zone: vm.availability_zone || '-',
          }));



          return (
            <Card
              key={order.system_id}
              title={`${order.system_name} - 资源详情`}
              extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateVMModal(order.system_id)}>创建虚拟机</Button>}
              style={{ marginBottom: 16 }}
            >
              <h4>虚拟机资源</h4>
              <Table dataSource={displayVMs} rowKey="name" columns={vmColumns} pagination={false} scroll={{ x: 1200 }} />

              <Divider />

              <Row gutter={16}>
                <Col span={12}>
                  <h4>存储资源</h4>
                  <Descriptions bordered size="small">
                    <Descriptions.Item label="订阅容量">{order.storage.subscribed_capacity} GB</Descriptions.Item>
                    <Descriptions.Item label="已用容量">{order.storage.used_capacity} GB</Descriptions.Item>
                    <Descriptions.Item label="可用容量">{order.storage.available_capacity} GB</Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col span={12}>
                  <h4>网络资源</h4>
                  <Descriptions bordered size="small">
                    <Descriptions.Item label="线路类型">{order.network.line_type}</Descriptions.Item>
                    <Descriptions.Item label="带宽">{order.network.bandwidth} Mbps</Descriptions.Item>
                    <Descriptions.Item label="开始时间">{order.network.start_time}</Descriptions.Item>
                    <Descriptions.Item label="状态"><Tag color="green">{order.network.status}</Tag></Descriptions.Item>
                  </Descriptions>
                </Col>
              </Row>
            </Card>
          );
        })}

        {orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <p>暂无系统资源，请先创建信息系统</p>
          </div>
        )}
      </div>
    );
  };

  // 产品订阅标签页
  const renderProducts = () => {
    return (
      <div>
        <Card title="可订阅产品">
          <Table dataSource={products} rowKey="id" columns={productColumns} />
        </Card>

        <Card title="我的订阅" style={{ marginTop: 16 }}>
          <Table
            dataSource={subscriptions?.products || []}
            rowKey="id"
            columns={[
              { title: '产品名称', dataIndex: 'product_name', key: 'product_name' },
              { title: '产品类型', dataIndex: 'product_type', key: 'product_type' },
              { title: '数量', dataIndex: 'quantity', key: 'quantity' },
              { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: (price) => `¥${price}` },
              { title: '月费用', dataIndex: 'monthly_cost', key: 'monthly_cost', render: (cost) => `¥${cost}` },
              { title: '状态', dataIndex: 'status', key: 'status', render: (status) => <Tag color="blue">{status}</Tag> },
              { title: '开始日期', dataIndex: 'start_date', key: 'start_date' },
              { title: '结束日期', dataIndex: 'end_date', key: 'end_date' }
            ]}
          />
        </Card>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', minWidth: '800px' }} >
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'info' && renderTenantInfo()}
      {activeTab === 'systems' && renderSystems()}
      {activeTab === 'products' && renderProducts()}
      {/* Orders tab is merged into systems or handled by TenantOrders page */}

      {/* 创建信息系统模态框 */}
      <Modal
        title="创建信息系统"
        open={systemModalVisible}
        onOk={handleCreateSystem}
        onCancel={() => setSystemModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="系统名称" rules={[{ required: true, message: '请输入系统名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="系统编码" rules={[{ required: true, message: '请输入系统编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="operation_mode" label="运行模式">
            <Select defaultValue="7x24">
              <Option value="7x24">7x24小时</Option>
              <Option value="5x8">5x8小时</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 订阅产品模态框 */}
      <Modal
        title="订阅产品"
        open={productModalVisible}
        onOk={handleSubscribeProduct}
        onCancel={() => setProductModalVisible(false)}
      >
        <Form form={productForm} layout="vertical">
          <Form.Item name="product_id" label="产品ID" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="quantity" label="订阅数量" initialValue={1} rules={[{ required: true, message: '请输入数量' }]}>
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item name="start_date" label="开始日期" rules={[{ required: true, message: '请选择开始日期' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="end_date" label="结束日期" rules={[{ required: true, message: '请选择结束日期' }]}>
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建虚拟机向导 - OpenStack风格 */}
      <VMCreateWizard
        visible={vmModalVisible}
        onCancel={() => {
          setVmModalVisible(false);
          setSelectedSystemId(null);
        }}
        onSuccess={() => {
          fetchAllData();
        }}
        systems={systems}
        selectedSystemId={selectedSystemId}
      />

      <VMDetailModal
        visible={vmDetailModalVisible}
        vm={selectedVm}
        flavors={flavors}
        onClose={() => {
          setVmDetailModalVisible(false);
          setSelectedVm(null);
        }}
        onRefresh={fetchAllData}
      />

      <VMEditModal
        visible={vmEditModalVisible}
        vm={selectedVmForEdit}
        onClose={() => {
          setVmEditModalVisible(false);
          setSelectedVmForEdit(null);
        }}
        onSuccess={fetchAllData}
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
        okText="提交resize"
        cancelText="取消"
      >
        {selectedVmForResize && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>虚拟机名称：</strong>{selectedVmForResize.name}</p>
            <p><strong>当前配置：</strong>
              {selectedVmForResize.flavor?.name || '未知'}
              ({selectedVmForResize.flavor?.vcpus || selectedVmForResize.cpu || '?'}核 /
              {selectedVmForResize.flavor?.ram ? Math.round(selectedVmForResize.flavor.ram / 1024) : (selectedVmForResize.memory || '?')}GB RAM /
              {selectedVmForResize.flavor?.disk || selectedVmForResize.disk || '?'}GB 磁盘)
            </p>
            <Divider />
          </div>
        )}
        <Form form={resizeForm} layout="vertical">
          <Form.Item
            label="选择新的实例类型 (Flavor)"
            name="new_flavor_id"
            rules={[{ required: true, message: '请选择新的实例类型' }]}
          >
            <Select placeholder="选择新配置" showSearch optionFilterProp="children">
              {flavors
                .filter(f => f.id !== selectedVmForResize?.flavor?.id)
                .map(flavor => (
                  <Select.Option key={flavor.id} value={flavor.id}>
                    {flavor.name} ({flavor.vcpus}核 / {Math.round(flavor.ram / 1024)}GB / {flavor.disk}GB)
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
          <p style={{ margin: '4px 0', fontSize: 12, color: '#d48806' }}>⚠️ <strong>Resize注意事项：</strong></p>
          <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>• VM会在resize期间重启</p>
          <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>• 提交后VM状态变为VERIFY_RESIZE</p>
          <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>• 您可以在新配置下测试VM，然后选择<strong>确认</strong>或<strong>回滚</strong></p>
        </div>
      </Modal>
    </div >

  );
};

export default TenantPortal;
