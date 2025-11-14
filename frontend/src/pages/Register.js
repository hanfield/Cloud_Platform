import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Select, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, CloudOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import userService from '../services/userService';
import tenantService from '../services/tenantService';

const { Option } = Select;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await tenantService.getTenants({ status: 'active', page_size: 1000 });
      setTenants(response.results || response);
    } catch (error) {
      message.error('获取租户列表失败');
    }
  };

  const handleRegister = async (values) => {
    setLoading(true);
    try {
      await userService.register(values);
      message.success('注册成功！请等待管理员审核');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      const errorMsg = error.response?.data?.detail ||
                      error.response?.data?.username?.[0] ||
                      error.response?.data?.email?.[0] ||
                      error.response?.data?.tenant_id?.[0] ||
                      '注册失败，请检查输入信息';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <Card
        title={
          <Space>
            <CloudOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <span>用户注册</span>
          </Space>
        }
        style={{
          width: 500,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
      >
        <Form
          name="register"
          onFinish={handleRegister}
          autoComplete="off"
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="邮箱"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item
            name="password_confirm"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
            />
          </Form.Item>

          <Form.Item
            name="tenant_id"
            label="所属租户"
            rules={[{ required: true, message: '请选择所属租户' }]}
          >
            <Select
              placeholder="选择您所属的租户"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {tenants.map(tenant => (
                <Option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.code})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号（选填）"
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder="手机号"
            />
          </Form.Item>

          <Form.Item
            name="department"
            label="部门（选填）"
          >
            <Input placeholder="部门" />
          </Form.Item>

          <Form.Item
            name="position"
            label="职位（选填）"
          >
            <Input placeholder="职位" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{ width: '100%' }}
            >
              注册
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            已有账号？
            <Button type="link" onClick={() => navigate('/login')}>
              立即登录
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Register;