/**
 * 服务表单组件
 */

import React, { useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Row,
  Col,
  Divider,
  Card,
  Typography
} from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const ServiceForm = ({ initialValues, onSubmit, onCancel }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    } else {
      form.resetFields();
    }
  }, [initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 服务类型选项
  const serviceTypeOptions = [
    { value: 'sla', label: 'SLA服务' },
    { value: 'support', label: '技术支持' },
    { value: 'monitoring', label: '监控服务' },
    { value: 'backup', label: '备份服务' },
    { value: 'security', label: '安全服务' },
    { value: 'network', label: '网络服务' },
    { value: 'other', label: '其他服务' }
  ];

  // 状态选项
  const statusOptions = [
    { value: 'active', label: '启用' },
    { value: 'inactive', label: '停用' },
    { value: 'draft', label: '草稿' },
    { value: 'suspended', label: '暂停' }
  ];

  // 可用性级别选项
  const availabilityOptions = [
    { value: '99.999%', label: '99.999%' },
    { value: '99.99%', label: '99.99%' },
    { value: '99.75%', label: '99.75%' },
    { value: '99.9%', label: '99.9%' }
  ];

  // MTTR选项
  const mttrOptions = [
    { value: '<=30分钟', label: '<=30分钟' },
    { value: '<=2小时', label: '<=2小时' },
    { value: '<=4小时', label: '<=4小时' },
    { value: '<=8小时', label: '<=8小时' },
    { value: '<=24小时', label: '<=24小时' }
  ];

  // RPO选项
  const rpoOptions = [
    { value: '0', label: '0' },
    { value: '1小时', label: '1小时' }
  ];

  // RTO选项
  const rtoOptions = [
    { value: '<=1小时', label: '<=1小时' },
    { value: '1小时<RTO<=4小时', label: '1小时<RTO<=4小时' },
    { value: '>4小时', label: '>4小时' }
  ];

  // 计费单位选项
  const billingUnitOptions = [
    { value: 'month', label: '月' },
    { value: 'quarter', label: '季度' },
    { value: 'year', label: '年' },
    { value: 'instance', label: '实例' },
    { value: 'gb', label: 'GB' },
    { value: 'hour', label: '小时' }
  ];

  // 计费周期选项
  const billingPeriodOptions = [
    { value: 'monthly', label: '月度' },
    { value: 'quarterly', label: '季度' },
    { value: 'yearly', label: '年度' },
    { value: 'onetime', label: '一次性' }
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      size="middle"
      initialValues={{
        status: 'draft',
        service_type: 'sla',
        availability: '99.99%',
        mttr: '<=4小时',
        rpo: '1小时',
        rto: '<=1小时',
        billing_unit: 'month',
        billing_period: 'monthly',
        base_price: 0
      }}
    >
      <Row gutter={24}>
        <Col span={12}>
          <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
            <Form.Item
              label="服务名称"
              name="name"
              rules={[
                { required: true, message: '请输入服务名称' },
                { max: 100, message: '服务名称不能超过100个字符' }
              ]}
            >
              <Input placeholder="请输入服务名称" />
            </Form.Item>

            <Form.Item
              label="服务编码"
              name="code"
              rules={[
                { required: true, message: '请输入服务编码' },
                { max: 50, message: '服务编码不能超过50个字符' }
              ]}
            >
              <Input placeholder="请输入服务编码" />
            </Form.Item>

            <Form.Item
              label="服务类型"
              name="service_type"
              rules={[{ required: true, message: '请选择服务类型' }]}
            >
              <Select placeholder="请选择服务类型">
                {serviceTypeOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="状态"
              name="status"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select placeholder="请选择状态">
                {statusOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="服务描述"
              name="description"
            >
              <TextArea
                rows={4}
                placeholder="请输入服务描述"
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title="SLA指标" style={{ marginBottom: 16 }}>
            <Form.Item
              label="可用性"
              name="availability"
              rules={[{ required: true, message: '请选择可用性级别' }]}
            >
              <Select placeholder="请选择可用性级别">
                {availabilityOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="平均修复时间 (MTTR)"
              name="mttr"
              rules={[{ required: true, message: '请选择MTTR' }]}
            >
              <Select placeholder="请选择MTTR">
                {mttrOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="恢复点目标 (RPO)"
              name="rpo"
              rules={[{ required: true, message: '请选择RPO' }]}
            >
              <Select placeholder="请选择RPO">
                {rpoOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="恢复时间目标 (RTO)"
              name="rto"
              rules={[{ required: true, message: '请选择RTO' }]}
            >
              <Select placeholder="请选择RTO">
                {rtoOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="投诉率"
              name="complaint_rate"
            >
              <InputNumber
                placeholder="请输入投诉率"
                min={0}
                max={100}
                precision={2}
                style={{ width: '100%' }}
                addonAfter="%"
              />
            </Form.Item>

            <Form.Item
              label="网络可用性"
              name="network_availability"
            >
              <InputNumber
                placeholder="请输入网络可用性"
                min={0}
                max={100}
                precision={2}
                style={{ width: '100%' }}
                addonAfter="%"
              />
            </Form.Item>
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Card size="small" title="定价信息" style={{ marginBottom: 16 }}>
            <Form.Item
              label="基础价格"
              name="base_price"
              rules={[{ required: true, message: '请输入基础价格' }]}
            >
              <InputNumber
                placeholder="请输入基础价格"
                min={0}
                precision={2}
                style={{ width: '100%' }}
                prefix="¥"
              />
            </Form.Item>

            <Form.Item
              label="计费单位"
              name="billing_unit"
              rules={[{ required: true, message: '请选择计费单位' }]}
            >
              <Select placeholder="请选择计费单位">
                {billingUnitOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="计费周期"
              name="billing_period"
              rules={[{ required: true, message: '请选择计费周期' }]}
            >
              <Select placeholder="请选择计费周期">
                {billingPeriodOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" title="其他信息" style={{ marginBottom: 16 }}>
            <Form.Item
              label="服务特性"
              name="features"
            >
              <TextArea
                rows={3}
                placeholder="请输入服务特性"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item
              label="技术规格"
              name="specifications"
            >
              <TextArea
                rows={3}
                placeholder="请输入技术规格"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item
              label="服务级别"
              name="service_level"
            >
              <Input placeholder="请输入服务级别" />
            </Form.Item>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
        <Space>
          <Button onClick={onCancel} icon={<CloseOutlined />}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            icon={<SaveOutlined />}
          >
            保存
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ServiceForm;