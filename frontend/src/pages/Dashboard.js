/**
 * 合同表单组件
 */

import React, { useEffect, useState } from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Row, Col, Button, message } from 'antd';
import moment from 'moment';
import tenantService from '../services/tenantService';

const { TextArea } = Input;
const { Option } = Select;

const ContractForm = ({ initialValues, onSubmit, onCancel, loading }) => {
  const [form] = Form.useForm();
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (initialValues) {
      const formValues = {
        ...initialValues,
        start_date: initialValues.start_date ? moment(initialValues.start_date) : null,
        end_date: initialValues.end_date ? moment(initialValues.end_date) : null,
        signed_date: initialValues.signed_date ? moment(initialValues.signed_date) : null
      };
      form.setFieldsValue(formValues);
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
      const submitValues = {
        ...values,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
        signed_date: values.signed_date ? values.signed_date.format('YYYY-MM-DD') : null
      };
      await onSubmit(submitValues);
      message.success(initialValues ? '更新成功' : '创建成功');
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
              label="合同编号"
              name="contract_number"
              rules={[
                { required: true, message: '请输入合同编号' },
                { min: 3, message: '合同编号至少3个字符' }
              ]}
            >
              <Input placeholder="请输入合同编号" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="合同标题"
              name="title"
              rules={[{ required: true, message: '请输入合同标题' }]}
            >
              <Input placeholder="请输入合同标题" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="合同描述"
          name="description"
        >
          <TextArea rows={3} placeholder="请输入合同描述" />
        </Form.Item>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">租户和类型</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="关联租户"
              name="tenant"
              rules={[{ required: true, message: '请选择租户' }]}
            >
              <Select
                placeholder="请选择租户"
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
              label="合同类型"
              name="contract_type"
              rules={[{ required: true, message: '请选择合同类型' }]}
            >
              <Select placeholder="请选择合同类型">
                <Option value="standard">标准合同</Option>
                <Option value="custom">定制合同</Option>
                <Option value="trial">试用合同</Option>
                <Option value="upgrade">升级合同</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">时间信息</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="开始日期"
              name="start_date"
              rules={[{ required: true, message: '请选择开始日期' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="请选择开始日期" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="结束日期"
              name="end_date"
              rules={[{ required: true, message: '请选择结束日期' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="请选择结束日期" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="签署日期"
              name="signed_date"
            >
              <DatePicker style={{ width: '100%' }} placeholder="请选择签署日期" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">计费信息</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="计费方式"
              name="billing_method"
              rules={[{ required: true, message: '请选择计费方式' }]}
            >
              <Select placeholder="请选择计费方式">
                <Option value="monthly">按月计费</Option>
                <Option value="quarterly">按季度计费</Option>
                <Option value="yearly">按年计费</Option>
                <Option value="pay_as_use">按使用量计费</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="合同总金额"
              name="total_amount"
              rules={[{ required: true, message: '请输入合同总金额' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                style={{ width: '100%' }}
                placeholder="请输入合同总金额"
                prefix="¥"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="折扣率"
              name="discount_rate"
              initialValue={1.0}
              rules={[{ required: true, message: '请输入折扣率' }]}
            >
              <InputNumber
                min={0}
                max={2}
                step={0.01}
                precision={2}
                style={{ width: '100%' }}
                placeholder="1.0表示无折扣"
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">客户联系信息</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="客户联系人"
              name="client_contact_person"
              rules={[{ required: true, message: '请输入客户联系人' }]}
            >
              <Input placeholder="请输入客户联系人" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="客户联系电话"
              name="client_contact_phone"
              rules={[{ required: true, message: '请输入客户联系电话' }]}
            >
              <Input placeholder="请输入客户联系电话" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="客户联系邮箱"
              name="client_contact_email"
              rules={[
                { required: true, message: '请输入客户联系邮箱' },
                { type: 'email', message: '请输入正确的邮箱格式' }
              ]}
            >
              <Input placeholder="请输入客户联系邮箱" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">我方联系信息</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="我方联系人"
              name="company_contact_person"
              rules={[{ required: true, message: '请输入我方联系人' }]}
            >
              <Input placeholder="请输入我方联系人" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="我方联系电话"
              name="company_contact_phone"
              rules={[{ required: true, message: '请输入我方联系电话' }]}
            >
              <Input placeholder="请输入我方联系电话" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="我方联系邮箱"
              name="company_contact_email"
              rules={[
                { required: true, message: '请输入我方联系邮箱' },
                { type: 'email', message: '请输入正确的邮箱格式' }
              ]}
            >
              <Input placeholder="请输入我方联系邮箱" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">合同条款</h3>
        <Form.Item
          label="合同条款"
          name="terms_and_conditions"
        >
          <TextArea rows={4} placeholder="请输入合同条款" />
        </Form.Item>

        <Form.Item
          label="特殊条款"
          name="special_terms"
        >
          <TextArea rows={3} placeholder="请输入特殊条款" />
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

export default ContractForm;