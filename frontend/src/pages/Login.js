import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Space, Tabs } from 'antd';
import { UserOutlined, LockOutlined, CloudOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { TabPane } = Tabs;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState('admin');
  const [platformName, setPlatformName] = useState('云平台管理系统');
  const navigate = useNavigate();

  // 获取系统设置（平台名称）
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const response = await api.get('/system/settings/');
        if (response && response.length > 0) {
          const settings = response[0];
          if (settings.platform_name) {
            setPlatformName(settings.platform_name);
          }
        }
      } catch (error) {
        // 获取失败时使用默认值，不影响用户体验
        console.log('获取系统设置失败，使用默认值', error);
      }
    };

    fetchSystemSettings();
  }, []);

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
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f2f5 0%, #e6f4ff 100%)',
      backgroundImage: 'url("https://gw.alipayobjects.com/zos/rmsportal/TVYTbAXWheQpRcWDaDMu.svg")',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center 110px',
      backgroundSize: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <Card
        bordered={false}
        style={{
          width: 420,
          maxWidth: '100%',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)'
        }}
        className="animate-float"
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <CloudOutlined style={{ fontSize: '48px', color: '#1668dc', marginBottom: 16 }} />
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#1f1f1f', marginBottom: 8 }}>
            {platformName}
          </div>
          <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
            Enterprise Cloud Management Platform
          </div>
        </div>

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
                租户登录
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
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Button type="link" onClick={() => navigate('/forgot-password')}>
            忘记密码？
          </Button>
          <span style={{ color: '#d9d9d9', margin: '0 8px' }}>|</span>
          <Button type="link" onClick={() => navigate('/register')}>
            立即注册
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Login;