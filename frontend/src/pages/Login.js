/**
 * 登录页面
 */

import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Space, Tabs } from 'antd';
import { UserOutlined, LockOutlined, CloudOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { TabPane } = Tabs;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState('admin');
  const navigate = useNavigate();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login/', {
        username: values.username,
        password: values.password
      });

      // 使用API返回的实际数据
      const userData = {
        username: response.username || values.username,
        user_type: response.user_type || userType,
        email: response.email || '',
        user_id: response.user_id
      };

      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      localStorage.setItem('user_type', response.user_type || userType);
      localStorage.setItem('user', JSON.stringify(userData));

      message.success('登录成功！');

      window.dispatchEvent(new Event('storage'));

      const redirectPath = (response.user_type || userType) === 'admin' ? '/dashboard' : '/tenant-portal';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      message.error('登录失败：用户名或密码错误');
      console.error('Login error:', error);
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
      alignItems: 'center'
    }}>
      <Card
        title={
          <Space>
            <CloudOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <span>云平台管理系统</span>
          </Space>
        }
        style={{
          width: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
      >
        <Tabs activeKey={userType} onChange={setUserType} centered>
          <TabPane
            tab={
              <span>
                <SettingOutlined />
                管理员登录
              </span>
            }
            key="admin"
          />
          <TabPane
            tab={
              <span>
                <TeamOutlined />
                用户登录
              </span>
            }
            key="tenant"
          />
        </Tabs>

        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名!' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码!' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{ width: '100%' }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', marginBottom: '10px' }}>
          {userType === 'admin' ? '管理员账号: admin / admin123' : '租户账号: tenant / tenant123'}
        </div>

        <div style={{ textAlign: 'center' }}>
          <Button type="link" onClick={() => navigate('/forgot-password')}>
            忘记密码？
          </Button>
          <span style={{ color: '#d9d9d9' }}>|</span>
          <Button type="link" onClick={() => navigate('/register')}>
            立即注册
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Login;