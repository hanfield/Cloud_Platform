/**
 * 信息系统表单组件
 */

import React, { useEffect, useState } from 'react';
import { Form, Input, Select, InputNumber, Row, Col, Button, message } from 'antd';
import tenantService from '../services/tenantService';

const { TextArea } = Input;
const { Option } = Select;

const InformationSystemForm = ({ initialValues, onSubmit, onCancel, loading }) => {
  const [form] = Form.useForm();
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  const fetchTenants = async () => {
    setLoadingTenants(true);
    try {
      const response = await tenantService.getTenants({ status: 'active' });
      setTenants(response.results || response);
    } catch (error) {
      message.error('获取租户列表失败');
    } finally {
      setLoadingTenants(false);
    }
  };

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
              label="系统名称"
              name="name"
              rules={[
                { required: true, message: '请输入系统名称' },
                { min: 2, message: '系统名称至少2个字符' }
              ]}
            >
              <Input placeholder="请输入系统名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="系统编码"
              name="code"
              rules={[
                { required: true, message: '请输入系统编码' },
                { min: 3, message: '系统编码至少3个字符' }
              ]}
            >
              <Input placeholder="请输入系统编码" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="系统类型"
              name="system_type"
              rules={[{ required: true, message: '请选择系统类型' }]}
            >
              <Select placeholder="请选择系统类型">
                <Option value="web">Web应用</Option>
                <Option value="database">数据库系统</Option>
                <Option value="middleware">中间件</Option>
                <Option value="application">业务应用</Option>
                <Option value="monitoring">监控系统</Option>
                <Option value="backup">备份系统</Option>
                <Option value="other">其他</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="运行模式"
              name="operation_mode"
              rules={[{ required: true, message: '请选择运行模式' }]}
            >
              <Select placeholder="请选择运行模式">
                <Option value="7x24">7x24小时</Option>
                <Option value="5x8">5x8小时</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="系统描述"
          name="description"
        >
          <TextArea rows={3} placeholder="请输入系统描述" />
        </Form.Item>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">资源信息</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="CPU总量 (核)"
              name="total_cpu"
              initialValue={0}
              rules={[{ required: true, message: '请输入CPU总量' }]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="请输入CPU总量"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="内存总量 (GB)"
              name="total_memory"
              initialValue={0}
              rules={[{ required: true, message: '请输入内存总量' }]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="请输入内存总量"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="存储总量 (GB)"
              name="total_storage"
              initialValue={0}
              rules={[{ required: true, message: '请输入存储总量' }]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="请输入存储总量"
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">关联信息</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="所属租户"
              name="tenant"
              rules={[{ required: true, message: '请选择所属租户' }]}
            >
              <Select
                placeholder="请选择所属租户"
                loading={loadingTenants}
                showSearch
                optionFilterProp="children"
              >
                {tenants.map(tenant => (
                  <Option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.code})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="初始状态"
              name="status"
              initialValue="stopped"
              rules={[{ required: true, message: '请选择初始状态' }]}
            >
              <Select placeholder="请选择初始状态">
                <Option value="running">运行中</Option>
                <Option value="stopped">已停止</Option>
                <Option value="maintenance">维护中</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">服务内容</h3>
        <Form.Item
          label="服务内容描述"
          name="service_content"
        >
          <TextArea rows={4} placeholder="请输入服务内容描述，包括支持的服务类型、服务级别等" />
        </Form.Item>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">产品内容</h3>
        <Form.Item
          label="产品内容描述"
          name="product_content"
        >
          <TextArea rows={4} placeholder="请输入产品内容描述，包括提供的产品功能、特性等" />
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

export default InformationSystemForm;