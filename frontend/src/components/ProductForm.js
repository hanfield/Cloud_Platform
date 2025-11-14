/**
 * 产品表单组件
 */

import React, { useEffect } from 'react';
import { Form, Input, Select, InputNumber, Row, Col, Button } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

const ProductForm = ({ initialValues, onSubmit, onCancel, loading }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      className="form-container"
    >
      <div className="form-section">
        <h3 className="form-section-title">基本信息</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="产品名称"
              name="name"
              rules={[
                { required: true, message: '请输入产品名称' },
                { min: 2, message: '产品名称至少2个字符' }
              ]}
            >
              <Input placeholder="请输入产品名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="产品编码"
              name="code"
              rules={[
                { required: true, message: '请输入产品编码' },
                { min: 3, message: '产品编码至少3个字符' }
              ]}
            >
              <Input placeholder="请输入产品编码" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="产品类型"
              name="product_type"
              rules={[{ required: true, message: '请选择产品类型' }]}
            >
              <Select placeholder="请选择产品类型">
                <Option value="ecs">ECS计算资源</Option>
                <Option value="ods">ODS存储资源</Option>
                <Option value="net">NET网络专线</Option>
                <Option value="anq">AnQ安全服务</Option>
                <Option value="bas">BAS基础服务</Option>
                <Option value="other">其他服务</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="初始状态"
              name="status"
              initialValue="active"
              rules={[{ required: true, message: '请选择初始状态' }]}
            >
              <Select placeholder="请选择初始状态">
                <Option value="active">启用</Option>
                <Option value="inactive">停用</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="产品描述"
          name="description"
        >
          <TextArea rows={3} placeholder="请输入产品描述" />
        </Form.Item>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">定价信息</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="基础价格"
              name="base_price"
              initialValue={0}
              rules={[{ required: true, message: '请输入基础价格' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="请输入基础价格"
                prefix="¥"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="计费单位"
              name="billing_unit"
              rules={[{ required: true, message: '请输入计费单位' }]}
            >
              <Select placeholder="请选择计费单位">
                <Option value="core">核/小时</Option>
                <Option value="gb">GB/小时</Option>
                <Option value="instance">实例/小时</Option>
                <Option value="connection">连接数/小时</Option>
                <Option value="request">请求数/万次</Option>
                <Option value="month">月</Option>
                <Option value="year">年</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="计费周期"
              name="billing_period"
              rules={[{ required: true, message: '请选择计费周期' }]}
            >
              <Select placeholder="请选择计费周期">
                <Option value="hourly">按小时</Option>
                <Option value="daily">按天</Option>
                <Option value="monthly">按月</Option>
                <Option value="yearly">按年</Option>
                <Option value="usage">按使用量</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="定价模型"
              name="pricing_model"
              rules={[{ required: true, message: '请选择定价模型' }]}
            >
              <Select placeholder="请选择定价模型">
                <Option value="fixed">固定价格</Option>
                <Option value="tiered">阶梯价格</Option>
                <Option value="usage_based">按使用量</Option>
                <Option value="subscription">订阅制</Option>
                <Option value="hybrid">混合模式</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="最小购买量"
              name="min_quantity"
              initialValue={1}
              rules={[{ required: true, message: '请输入最小购买量' }]}
            >
              <InputNumber
                min={1}
                precision={0}
                style={{ width: '100%' }}
                placeholder="请输入最小购买量"
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">容量配置</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="CPU容量 (核)"
              name="cpu_capacity"
              initialValue={0}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="请输入CPU容量"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="内存容量 (GB)"
              name="memory_capacity"
              initialValue={0}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="请输入内存容量"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="存储容量 (GB)"
              name="storage_capacity"
              initialValue={0}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="请输入存储容量"
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">产品特性</h3>
        <Form.Item
          label="产品特性描述"
          name="features"
        >
          <TextArea rows={4} placeholder="请输入产品特性描述，包括功能特点、技术规格等" />
        </Form.Item>
      </div>

      <div className="form-actions">
        <Button onClick={onCancel} style={{ marginRight: 16 }}>
          取消
        </Button>
        <Button type="primary" onClick={handleSubmit} loading={loading}>
          {initialValues ? '更新' : '创建'}
        </Button>
      </div>
    </Form>
  );
};

export default ProductForm;