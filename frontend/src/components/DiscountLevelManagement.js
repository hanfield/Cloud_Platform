/**
 * 折扣级别管理组件
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Tag,
  Tooltip,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  PercentageOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import productService from '../services/productService';

const { Option } = Select;

const DiscountLevelManagement = () => {
  const [discountLevels, setDiscountLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create or edit
  const [currentDiscount, setCurrentDiscount] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchDiscountLevels();
  }, []);

  // 获取折扣级别列表
  const fetchDiscountLevels = async () => {
    setLoading(true);
    try {
      const response = await productService.getDiscountLevels();
      setDiscountLevels(response.results || response);
    } catch (error) {
      message.error('获取折扣级别列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 打开创建模态框
  const handleCreate = () => {
    setModalMode('create');
    setCurrentDiscount(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (discount) => {
    setModalMode('edit');
    setCurrentDiscount(discount);
    form.setFieldsValue(discount);
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (modalMode === 'create') {
        await productService.createDiscountLevel(values);
        message.success('创建成功');
      } else {
        await productService.updateDiscountLevel(currentDiscount.id, values);
        message.success('更新成功');
      }

      setModalVisible(false);
      fetchDiscountLevels();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  // 删除折扣级别
  const handleDelete = async (id) => {
    try {
      await productService.deleteDiscountLevel(id);
      fetchDiscountLevels();
    } catch (error) {
      throw error;
    }
  };

  // 计算统计信息
  const calculateStats = () => {
    const totalLevels = discountLevels.length;
    const activeLevels = discountLevels.filter(d => d.status === 'active').length;
    const avgDiscount = discountLevels.length > 0
      ? discountLevels.reduce((sum, d) => sum + d.discount_rate, 0) / discountLevels.length
      : 0;

    return {
      totalLevels,
      activeLevels,
      avgDiscount: (avgDiscount * 100).toFixed(1)
    };
  };

  const stats = calculateStats();

  const columns = [
    {
      title: '折扣级别名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.code}</div>
        </div>
      )
    },
    {
      title: '折扣率',
      dataIndex: 'discount_rate',
      key: 'discount_rate',
      width: 100,
      render: (rate) => (
        <Tag color="green">
          {(rate * 100).toFixed(1)}%
        </Tag>
      )
    },
    {
      title: '客户类型',
      dataIndex: 'customer_type',
      key: 'customer_type',
      width: 120,
      render: (type) => {
        const typeMap = {
          'government': '政府机构',
          'enterprise': '企业客户',
          'education': '教育机构',
          'startup': '创业公司',
          'partner': '合作伙伴',
          'other': '其他'
        };
        const colorMap = {
          'government': 'blue',
          'enterprise': 'cyan',
          'education': 'green',
          'startup': 'orange',
          'partner': 'purple',
          'other': 'default'
        };
        return (
          <Tag color={colorMap[type]}>
            {typeMap[type] || type}
          </Tag>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      )
    },
    {
      title: '最小消费金额',
      dataIndex: 'min_amount',
      key: 'min_amount',
      width: 120,
      render: (amount) => amount ? `¥${amount}` : '无限制'
    },
    {
      title: '最大消费金额',
      dataIndex: 'max_amount',
      key: 'max_amount',
      width: 120,
      render: (amount) => amount ? `¥${amount}` : '无限制'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>

          <Popconfirm
            title="确定删除这个折扣级别吗？"
            description="删除后将无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总折扣级别"
              value={stats.totalLevels}
              prefix={<TeamOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="启用级别"
              value={stats.activeLevels}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PercentageOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="平均折扣率"
              value={stats.avgDiscount}
              valueStyle={{ color: '#1890ff' }}
              prefix=""
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchDiscountLevels}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建折扣级别
          </Button>
        </Space>
      </div>

      {/* 折扣级别表格 */}
      <Table
        columns={columns}
        dataSource={discountLevels}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1000 }}
        size="middle"
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          pageSize: 20
        }}
      />

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建折扣级别' : '编辑折扣级别'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          className="form-container"
        >
          <Form.Item
            label="折扣级别名称"
            name="name"
            rules={[
              { required: true, message: '请输入折扣级别名称' },
              { min: 2, message: '名称至少2个字符' }
            ]}
          >
            <Input placeholder="请输入折扣级别名称" />
          </Form.Item>

          <Form.Item
            label="折扣级别编码"
            name="code"
            rules={[
              { required: true, message: '请输入折扣级别编码' },
              { min: 3, message: '编码至少3个字符' }
            ]}
          >
            <Input placeholder="请输入折扣级别编码" />
          </Form.Item>

          <Form.Item
            label="折扣率"
            name="discount_rate"
            rules={[{ required: true, message: '请输入折扣率' }]}
          >
            <InputNumber
              min={0}
              max={1}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入折扣率，如0.9表示9折"
              formatter={value => `${(value * 100).toFixed(0)}%`}
              parser={value => value.replace('%', '') / 100}
            />
          </Form.Item>

          <Form.Item
            label="客户类型"
            name="customer_type"
            rules={[{ required: true, message: '请选择客户类型' }]}
          >
            <Select placeholder="请选择客户类型">
              <Option value="government">政府机构</Option>
              <Option value="enterprise">企业客户</Option>
              <Option value="education">教育机构</Option>
              <Option value="startup">创业公司</Option>
              <Option value="partner">合作伙伴</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            initialValue="active"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="最小消费金额"
            name="min_amount"
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入最小消费金额，0表示无限制"
              prefix="¥"
            />
          </Form.Item>

          <Form.Item
            label="最大消费金额"
            name="max_amount"
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入最大消费金额，0表示无限制"
              prefix="¥"
            />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="请输入描述信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DiscountLevelManagement;