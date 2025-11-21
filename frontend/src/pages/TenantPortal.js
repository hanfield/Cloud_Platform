import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Button, Space, Tag, Descriptions, message, Modal, Form, Input, Select, Statistic, Divider, InputNumber, TimePicker, Progress } from 'antd';
import { UserOutlined, DesktopOutlined, ShoppingOutlined, PlusOutlined, PoweroffOutlined, PlayCircleOutlined, StopOutlined, TeamOutlined, EyeOutlined, SyncOutlined, ReloadOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import tenantPortalService from '../services/tenantPortalService';
import moment from 'moment';

const { Option } = Select;

const TenantPortal = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [systems, setSystems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState(null);
  const [products, setProducts] = useState([]);
  const [systemModalVisible, setSystemModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [vmModalVisible, setVmModalVisible] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [form] = Form.useForm();
  const [productForm] = Form.useForm();
  const [vmForm] = Form.useForm();

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

  const handleControlResource = async (resourceId, resourceType, action) => {
    try {
      await tenantPortalService.controlResource({ resource_id: resourceId, resource_type: resourceType, action });
      message.success(`资源${action === 'start' ? '启动' : '停止'}成功`);
      fetchAllData();
    } catch (error) {
      message.error('操作失败');
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
        system_id: selectedSystemId,
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

  const openCreateVMModal = (systemId) => {
    setSelectedSystemId(systemId);
    setVmModalVisible(true);
  };

  // 计算虚拟机状态统计
  const getVMStatusStats = () => {
    const allVMs = [];
    orders.forEach(order => {
      if (order.vm_resources) {
        allVMs.push(...order.vm_resources);
      }
    });

    const stats = allVMs.reduce((acc, vm) => {
      const status = vm.status || 'unknown';
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
    { title: '虚拟机名称', dataIndex: 'name', key: 'name' },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
    { title: '数据中心', dataIndex: 'data_center_type_display', key: 'data_center_type' },
    { title: '可用区', dataIndex: 'availability_zone', key: 'availability_zone' },
    { title: '运行时间', dataIndex: 'runtime', key: 'runtime' },
    { title: '操作系统', dataIndex: 'os_type', key: 'os_type' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status, record) => <Tag color={status === 'running' ? 'green' : 'red'}>{record.status_display}</Tag> },
    { title: 'CPU', dataIndex: 'cpu', key: 'cpu', render: (cpu) => `${cpu}核` },
    { title: '内存', dataIndex: 'memory', key: 'memory', render: (mem) => `${mem}GB` },
    { title: '磁盘', dataIndex: 'disk', key: 'disk', render: (disk) => `${disk}GB` },
    { title: '最新启动时间', dataIndex: 'last_start_time', key: 'last_start_time', render: (time) => time || '-' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'running' ? (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => handleControlResource(record.id, 'vm', 'stop')}>停止</Button>
          ) : (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleControlResource(record.id, 'vm', 'start')}>启动</Button>
          )}
        </Space>
      )
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
                {autoRefresh ? ' 自动刷新中' : ' 已暂停'}
              </Tag>
              <Button
                size="small"
                icon={autoRefresh ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? '暂停刷新' : '开启刷新'}
              </Button>
              <Button size="small" icon={<ReloadOutlined />} onClick={fetchAllData}>
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

        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setSystemModalVisible(true)}>创建新系统</Button>
        </div>

        {/* 各系统的虚拟机列表 */}
        {orders.map((order) => (
          <Card
            key={order.system_id}
            title={`${order.system_name} - 资源详情`}
            extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateVMModal(order.system_id)}>创建虚拟机</Button>}
            style={{ marginBottom: 16 }}
          >
            <h4>虚拟机资源</h4>
            <Table dataSource={order.vm_resources} rowKey="name" columns={vmColumns} pagination={false} />

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
        ))}

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
    <div style={{ padding: '24px' }} >
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

      {/* 创建虚拟机模态框 */}
      <Modal
        title="创建虚拟机"
        open={vmModalVisible}
        onOk={handleCreateVM}
        onCancel={() => { setVmModalVisible(false); vmForm.resetFields(); setSelectedSystemId(null); }}
        width={600}
      >
        <Form form={vmForm} layout="vertical">
          <Form.Item name="name" label="虚拟机名称" rules={[{ required: true, message: '请输入虚拟机名称' }]}>
            <Input placeholder="例如: Web-Server-01" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="cpu_cores" label="CPU核数" initialValue={2} rules={[{ required: true, message: '请输入CPU核数' }]}>
                <InputNumber min={1} max={64} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="memory_gb" label="内存(GB)" initialValue={4} rules={[{ required: true, message: '请输入内存大小' }]}>
                <InputNumber min={1} max={512} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="disk_gb" label="磁盘(GB)" initialValue={100} rules={[{ required: true, message: '请输入磁盘大小' }]}>
                <InputNumber min={10} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="os_type" label="操作系统" initialValue="Linux" rules={[{ required: true, message: '请选择操作系统' }]}>
                <Select>
                  <Option value="Linux">Linux</Option>
                  <Option value="Windows Server">Windows Server</Option>
                  <Option value="CentOS">CentOS</Option>
                  <Option value="Ubuntu">Ubuntu</Option>
                  <Option value="Debian">Debian</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="os_version" label="系统版本">
                <Input placeholder="例如: 20.04" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="data_center_type" label="数据中心类型" initialValue="production" rules={[{ required: true, message: '请选择数据中心类型' }]}>
                <Select>
                  <Option value="production">生产环境</Option>
                  <Option value="local_dr">同城灾备</Option>
                  <Option value="remote_dr">异地灾备</Option>
                  <Option value="development">开发环境</Option>
                  <Option value="testing">测试环境</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="availability_zone" label="可用区">
                <Input placeholder="例如: az1" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="region" label="区域">
            <Input placeholder="例如: 北京一区" />
          </Form.Item>

          <Form.Item name="ip_address" label="IP地址">
            <Input placeholder="例如: 192.168.1.100 (可选)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="runtime_start" label="运行开始时间">
                <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="选择开始时间" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="runtime_end" label="运行结束时间">
                <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="选择结束时间" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="虚拟机用途描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div >
  );
};

export default TenantPortal;
