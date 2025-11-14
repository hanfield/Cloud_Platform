import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Tabs, Table, Button, Space, Tag, Descriptions, message, Modal, Form, Input, Select, Statistic } from 'antd';
import { UserOutlined, DesktopOutlined, ShoppingOutlined, PlusOutlined, PoweroffOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import tenantPortalService from '../services/tenantPortalService';

const { TabPane } = Tabs;
const { Option } = Select;

const TenantPortal = () => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [systems, setSystems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState(null);
  const [products, setProducts] = useState([]);
  const [systemModalVisible, setSystemModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [productForm] = Form.useForm();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const profileRes = await tenantPortalService.getTenantProfile();
      setProfile(profileRes);
      const systemsRes = await tenantPortalService.getSystemsOverview();
      setSystems(systemsRes.systems || []);
      const ordersRes = await tenantPortalService.getTenantOrders();
      setOrders(ordersRes.orders || []);
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
  };

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

  const vmColumns = [
    { title: '虚拟机名称', dataIndex: 'name', key: 'name' },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
    { title: '运行时间', dataIndex: 'runtime', key: 'runtime' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === 'running' ? 'green' : 'red'}>{status === 'running' ? '运行中' : '已停止'}</Tag> },
    { title: 'CPU', dataIndex: 'cpu', key: 'cpu', render: (cpu) => `${cpu}核` },
    { title: '内存', dataIndex: 'memory', key: 'memory', render: (mem) => `${mem}GB` },
    { title: '磁盘', dataIndex: 'disk', key: 'disk', render: (disk) => `${disk}GB` },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'running' ? (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => handleControlResource(record.name, 'vm', 'stop')}>停止</Button>
          ) : (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleControlResource(record.name, 'vm', 'start')}>启动</Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title={<span><UserOutlined /> 租户门户</span>}>
        <Tabs defaultActiveKey="profile">
          <TabPane tab="基本信息" key="profile">
            {profile && (
              <>
                <Descriptions title="租户信息" bordered>
                  <Descriptions.Item label="租户名称">{profile.name}</Descriptions.Item>
                  <Descriptions.Item label="租户编码">{profile.code}</Descriptions.Item>
                  <Descriptions.Item label="状态">{profile.status_display}</Descriptions.Item>
                  <Descriptions.Item label="类型">{profile.tenant_type_display}</Descriptions.Item>
                  <Descriptions.Item label="级别">{profile.level_display}</Descriptions.Item>
                  <Descriptions.Item label="联系人">{profile.contact_person}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{profile.contact_phone}</Descriptions.Item>
                  <Descriptions.Item label="联系邮箱">{profile.contact_email}</Descriptions.Item>
                  <Descriptions.Item label="地址" span={3}>{profile.address}</Descriptions.Item>
                </Descriptions>
                <Card title="干系人信息" style={{ marginTop: 16 }} size="small">
                  <Table dataSource={profile.stakeholders} rowKey="id" pagination={false} columns={[
                    { title: '角色', dataIndex: 'role_display' },
                    { title: '姓名', dataIndex: 'name' },
                    { title: '部门', dataIndex: 'department' },
                    { title: '职位', dataIndex: 'position' }
                  ]} />
                </Card>
              </>
            )}
          </TabPane>

          <TabPane tab="信息系统概览" key="systems">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Card><Statistic title="信息系统总数" value={systems.length} /></Card></Col>
              <Col span={8}><Card><Statistic title="运行中" value={systems.filter(s => s.status === 'running').length} valueStyle={{ color: '#3f8600' }} /></Card></Col>
              <Col span={8}><Button type="primary" icon={<PlusOutlined />} onClick={() => setSystemModalVisible(true)}>创建信息系统</Button></Col>
            </Row>
            <Table dataSource={systems} rowKey="id" loading={loading} columns={[
              { title: '系统名称', dataIndex: 'name' },
              { title: '系统编码', dataIndex: 'code' },
              { title: '状态', dataIndex: 'status_display' },
              { title: '运行模式', dataIndex: 'runtime_mode_display' }
            ]} />
          </TabPane>

          <TabPane tab="订单管理" key="orders">
            {orders.map((order, index) => (
              <Card key={index} title={`${order.system_name} - 资源订单`} style={{ marginBottom: 16 }}>
                <Card title="虚拟机资源" size="small" style={{ marginBottom: 16 }}>
                  <Table dataSource={order.vm_resources} rowKey="name" columns={vmColumns} pagination={false} />
                </Card>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="存储资源" size="small">
                      <Descriptions column={1}>
                        <Descriptions.Item label="订阅容量">{order.storage.subscribed_capacity} GB</Descriptions.Item>
                        <Descriptions.Item label="已用容量">{order.storage.used_capacity} GB</Descriptions.Item>
                        <Descriptions.Item label="可用容量">{order.storage.available_capacity} GB</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="网络资源" size="small">
                      <Descriptions column={1}>
                        <Descriptions.Item label="线路类型">{order.network.line_type}</Descriptions.Item>
                        <Descriptions.Item label="带宽">{order.network.bandwidth} Mbps</Descriptions.Item>
                        <Descriptions.Item label="开通时间">{order.network.start_time}</Descriptions.Item>
                        <Descriptions.Item label="状态"><Tag color="green">{order.network.status}</Tag></Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>
              </Card>
            ))}
          </TabPane>

          <TabPane tab="产品订阅" key="subscriptions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setProductModalVisible(true)} style={{ marginBottom: 16 }}>订阅产品</Button>
            {subscriptions && (
              <>
                <Card title="已订阅产品" size="small" style={{ marginBottom: 16 }}>
                  <Table dataSource={subscriptions.products} rowKey="id" pagination={false} columns={[
                    { title: '产品名称', dataIndex: 'product_name' },
                    { title: '产品类型', dataIndex: 'product_type' },
                    { title: '数量', dataIndex: 'quantity' },
                    { title: '单价', dataIndex: 'unit_price' },
                    { title: '月费用', dataIndex: 'monthly_cost' },
                    { title: '状态', dataIndex: 'status' }
                  ]} />
                </Card>
                <Card title="已订阅服务" size="small">
                  <Table dataSource={subscriptions.services} rowKey="id" pagination={false} columns={[
                    { title: '服务名称', dataIndex: 'service_name' },
                    { title: '服务类型', dataIndex: 'service_type' },
                    { title: '单价', dataIndex: 'unit_price' },
                    { title: '月费用', dataIndex: 'monthly_cost' },
                    { title: '状态', dataIndex: 'status' }
                  ]} />
                </Card>
              </>
            )}
          </TabPane>
        </Tabs>
      </Card>

      <Modal title="创建信息系统" open={systemModalVisible} onOk={handleCreateSystem} onCancel={() => setSystemModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="系统名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="系统编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="runtime_mode" label="运行模式" rules={[{ required: true }]}>
            <Select><Option value="7x24">7x24小时</Option><Option value="5x8">5x8小时</Option></Select>
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="订阅产品" open={productModalVisible} onOk={handleSubscribeProduct} onCancel={() => setProductModalVisible(false)}>
        <Form form={productForm} layout="vertical">
          <Form.Item name="product_id" label="选择产品" rules={[{ required: true }]}>
            <Select placeholder="请选择产品">
              {products.map(p => <Option key={p.id} value={p.id}>{p.name} - {p.product_type_display}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}><Input type="number" min={1} /></Form.Item>
          <Form.Item name="start_date" label="开始日期" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="end_date" label="结束日期" rules={[{ required: true }]}><Input type="date" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantPortal;
