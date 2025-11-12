/**
 * 租户表单组件
 */

import React, { useEffect } from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Row, Col, Button, message } from 'antd';
import moment from 'moment';

const { TextArea } = Input;
const { Option } = Select;

const TenantForm = ({ initialValues, onSubmit, onCancel, loading }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (initialValues) {
      // 转换日期字段
      const formValues = {
        ...initialValues,
        start_time: initialValues.start_time ? moment(initialValues.start_time) : null,
        end_time: initialValues.end_time ? moment(initialValues.end_time) : null
      };
      form.setFieldsValue(formValues);
    }
  }, [initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // 转换日期为字符串
      const submitValues = {
        ...values,
        start_time: values.start_time ? values.start_time.format('YYYY-MM-DD') : null,
        end_time: values.end_time ? values.end_time.format('YYYY-MM-DD') : null
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
              label="租户名称"
              name="name"
              rules={[
                { required: true, message: '请输入租户名称' },
                { min: 2, message: '租户名称至少2个字符' }
              ]}
            >
              <Input placeholder="请输入租户名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="租户编码"
              name="code"
              rules={[
                { required: true, message: '请输入租户编码' },
                { pattern: /^[A-Z0-9]+$/, message: '只能包含大写字母和数字' }
              ]}
            >
              <Input placeholder="请输入租户编码" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="描述"
          name="description"
        >
          <TextArea rows={3} placeholder="请输入描述" />
        </Form.Item>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">租户分类</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="租户级别"
              name="level"
              rules={[{ required: true, message: '请选择租户级别' }]}
            >
              <Select placeholder="请选择租户级别">
                <Option value="superior">上级单位</Option>
                <Option value="important">重要客户</Option>
                <Option value="ordinary">普通客户</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="折扣级别"
              name="discount_level"
              rules={[{ required: true, message: '请选择折扣级别' }]}
            >
              <Select placeholder="请选择折扣级别">
                <Option value="level_a">A级(9折)</Option>
                <Option value="level_b">B级(8.5折)</Option>
                <Option value="level_c">C级(8折)</Option>
                <Option value="level_d">D级(7.5折)</Option>
                <Option value="level_e">E级(7折)</Option>
                <Option value="level_f">F级(6.5折)</Option>
                <Option value="no_discount">无折扣</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="租户类型"
              name="tenant_type"
              rules={[{ required: true, message: '请选择租户类型' }]}
            >
              <Select placeholder="请选择租户类型">
                <Option value="virtual">虚拟资源</Option>
                <Option value="virtual_physical">虚拟+物理资源</Option>
                <Option value="virtual_physical_network">虚拟+物理+网络线路资源</Option>
                <Option value="datacenter_cabinet">机房机柜资源</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">联系信息</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="联系人"
              name="contact_person"
              rules={[{ required: true, message: '请输入联系人' }]}
            >
              <Input placeholder="请输入联系人" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="联系电话"
              name="contact_phone"
              rules={[
                { required: true, message: '请输入联系电话' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' }
              ]}
            >
              <Input placeholder="请输入联系电话" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="联系邮箱"
              name="contact_email"
              rules={[
                { required: true, message: '请输入联系邮箱' },
                { type: 'email', message: '请输入正确的邮箱格式' }
              ]}
            >
              <Input placeholder="请输入联系邮箱" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="地址"
          name="address"
        >
          <TextArea rows={2} placeholder="请输入地址" />
        </Form.Item>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">时间信息</h3>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="开始时间"
              name="start_time"
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="请选择开始时间" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="结束时间"
              name="end_time"
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <DatePicker style={{ width: '100%' }} placeholder="请选择结束时间" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">资源配额</h3>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="vCPU配额"
              name="quota_vcpus"
              initialValue={0}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入vCPU配额" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="内存配额(GB)"
              name="quota_memory"
              initialValue={0}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入内存配额" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="磁盘配额(GB)"
              name="quota_disk"
              initialValue={0}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入磁盘配额" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="实例配额"
              name="quota_instances"
              initialValue={0}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入实例配额" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="网络配额"
              name="quota_networks"
              initialValue={0}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入网络配额" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="浮动IP配额"
              name="quota_floating_ips"
              initialValue={0}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入浮动IP配额" />
            </Form.Item>
          </Col>
        </Row>
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

export default TenantForm;