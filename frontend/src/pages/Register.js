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
      // 使用公开API获取租户列表
      const response = await fetch('/api/tenants/public_list/');
      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }
      const data = await response.json();
      setTenants(data);
    } catch (error) {
      console.error('获取租户列表失败:', error);
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
      console.error('注册错误:', error);

      // 获取详细的错误信息
      let errorMsg = '注册失败，请检查输入信息';

      if (error.response?.data) {
        const errorData = error.response.data;

        // 处理字段级别的错误
        if (typeof errorData === 'object') {
          // 优先显示特定字段的错误
          if (errorData.username) {
            errorMsg = Array.isArray(errorData.username)
              ? errorData.username[0]
              : errorData.username;
          } else if (errorData.email) {
            errorMsg = Array.isArray(errorData.email)
              ? errorData.email[0]
              : errorData.email;
          } else if (errorData.password) {
            errorMsg = Array.isArray(errorData.password)
              ? errorData.password[0]
              : errorData.password;
          } else if (errorData.password_confirm) {
            errorMsg = Array.isArray(errorData.password_confirm)
              ? errorData.password_confirm[0]
              : errorData.password_confirm;
          } else if (errorData.tenant_id) {
            errorMsg = Array.isArray(errorData.tenant_id)
              ? errorData.tenant_id[0]
              : errorData.tenant_id;
          } else if (errorData.detail) {
            errorMsg = errorData.detail;
          } else {
            // 显示第一个错误
            const firstError = Object.values(errorData)[0];
            errorMsg = Array.isArray(firstError) ? firstError[0] : firstError;
          }
        } else if (typeof errorData === 'string') {
          errorMsg = errorData;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px'
    }}>
      <Card
        title={
          <Space>
            <CloudOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <span>用户注册</span>
          </Space>
        }
        style={{
          width: 480,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
      >
        <Form
          name="register"
          onFinish={handleRegister}
          autoComplete="off"
          size="middle"
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
            tooltip="密码至少8个字符，不能全为数字，不能是常见密码，不能与用户信息太相似"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8个字符' },
              {
                pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                message: '密码必须包含字母和数字'
              }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入包含字母和数字的密码"
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