import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Tabs, message, Modal, Form, Input, Select, DatePicker, InputNumber, Row, Col, Statistic } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ToolOutlined, FileTextOutlined } from '@ant-design/icons';
import moment from 'moment';
import assetService from '../services/assetService';

const { TabPane } = Tabs;
const { Option } = Select;

const AssetManagement = () => {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  useEffect(() => {
    fetchAssets();
    fetchStatistics();
  }, [pagination.current]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const response = await assetService.getPhysicalAssets({
        page: pagination.current,
        page_size: pagination.pageSize
      });
      setAssets(response.data.results || []);
      setPagination({ ...pagination, total: response.data.count });
    } catch (error) {
      message.error('获取资产列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await assetService.getPhysicalAssetStatistics();
      setStatistics(response.data);
    } catch (error) {
      console.error('获取统计信息失败', error);
    }
  };

  const handleAdd = () => {
    setEditingAsset(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingAsset(record);
    form.setFieldsValue({
      ...record,
      purchase_date: record.purchase_date ? moment(record.purchase_date) : null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个资产吗？',
      onOk: async () => {
        try {
          await assetService.deletePhysicalAsset(id);
          message.success('删除成功');
          fetchAssets();
          fetchStatistics();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null
      };

      if (editingAsset) {
        await assetService.updatePhysicalAsset(editingAsset.id, data);
        message.success('更新成功');
      } else {
        await assetService.createPhysicalAsset(data);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchAssets();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '资产名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '资产类型', dataIndex: 'asset_type_display', key: 'asset_type_display', width: 100 },
    { title: '设备厂商', dataIndex: 'manufacturer', key: 'manufacturer', width: 120 },
    { title: '设备型号', dataIndex: 'model', key: 'model', width: 120 },
    { title: '序列号', dataIndex: 'serial_number', key: 'serial_number', width: 150 },
    {
      title: '状态',
      dataIndex: 'status_display',
      key: 'status',
      width: 100,
      render: (text, record) => {
        const colorMap = {
          'in_use': 'green',
          'idle': 'blue',
          'maintenance': 'orange',
          'retired': 'gray',
          'damaged': 'red'
        };
        return <Tag color={colorMap[record.status]}>{text}</Tag>;
      }
    },
    { title: '数据中心', dataIndex: 'data_center', key: 'data_center', width: 100 },
    { title: '机房', dataIndex: 'machine_room', key: 'machine_room', width: 100 },
    { title: '机柜', dataIndex: 'cabinet', key: 'cabinet', width: 80 },
    {
      title: 'U位',
      key: 'u_position',
      width: 100,
      render: (_, record) => record.u_position_start && record.u_position_end
        ? `${record.u_position_start}-${record.u_position_end}`
        : '-'
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title="资产管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增资产</Button>}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic title="总资产数" value={statistics.total_count || 0} />
          </Col>
        </Row>

        <Tabs defaultActiveKey="physical">
          <TabPane tab={<span><ToolOutlined />有形资产</span>} key="physical">
            <Table
              columns={columns}
              dataSource={assets}
              rowKey="id"
              loading={loading}
              pagination={{
                ...pagination,
                onChange: (page) => setPagination({ ...pagination, current: page })
              }}
              scroll={{ x: 1500 }}
            />
          </TabPane>
          <TabPane tab={<span><FileTextOutlined />无形资产</span>} key="intangible">
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              无形资产功能待完善
            </div>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={editingAsset ? '编辑资产' : '新增资产'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="资产名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_type" label="资产类型" rules={[{ required: true }]}>
                <Select>
                  <Option value="server">服务器</Option>
                  <Option value="storage">存储设备</Option>
                  <Option value="network">网络设备</Option>
                  <Option value="security">安全设备</Option>
                  <Option value="other">其他设备</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="manufacturer" label="设备厂商" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="设备型号" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serial_number" label="序列号" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="资产状态" rules={[{ required: true }]}>
                <Select>
                  <Option value="in_use">使用中</Option>
                  <Option value="idle">闲置</Option>
                  <Option value="maintenance">维护中</Option>
                  <Option value="retired">已退役</Option>
                  <Option value="damaged">损坏</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="purchase_date" label="采购日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="purchase_price" label="采购价格">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="residual_value" label="残值">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="data_center" label="数据中心">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="machine_room" label="机房">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cabinet" label="机柜">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="u_position_start" label="起始U位">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="u_position_end" label="结束U位">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetManagement;
