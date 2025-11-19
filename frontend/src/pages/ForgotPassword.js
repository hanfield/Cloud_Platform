/**
 * 忘记密码页面
 */

import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Space, Steps } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, CloudOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { Step } = Steps;

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [userInfo, setUserInfo] = useState({ username: '', email: '' });
  const navigate = useNavigate();

  // 步骤1：验证用户信息
  const handleVerifyUser = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-user/', {
        username: values.username,
        email: values.email
      });

      setUserInfo(values);
      message.success('验证成功！请设置新密码');
      setCurrentStep(1);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || '验证失败，请检查用户名和邮箱';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 步骤2：重置密码
  const handleResetPassword = async (values) => {
    setLoading(true);
    try {
      await api.post('/auth/reset-password/', {
        username: userInfo.username,
        email: userInfo.email,
        new_password: values.new_password,
        confirm_password: values.confirm_password
      });

      message.success('密码重置成功！请使用新密码登录');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || '密码重置失败，请重试';
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
      alignItems: 'center'
    }}>
      <Card
        title={
          <Space>
            <CloudOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <span>找回密码</span>
          </Space>
        }
        style={{
          width: 450,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
      >
        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          <Step title="验证身份" />
          <Step title="重置密码" />
        </Steps>

        {currentStep === 0 && (
          <Form
            name="verify"
            onFinish={handleVerifyUser}
            autoComplete="off"
            size="large"
          >
            <p style={{ color: '#666', marginBottom: 24 }}>
              请输入您的用户名和注册邮箱来验证身份
            </p>

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
              name="email"
              rules={[
                { required: true, message: '请输入邮箱!' },
                { type: 'email', message: '请输入有效的邮箱地址!' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="注册邮箱"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ width: '100%' }}
              >
                验证身份
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            </div>
          </Form>
        )}

        {currentStep === 1 && (
          <Form
            name="reset"
            onFinish={handleResetPassword}
            autoComplete="off"
            size="large"
          >
            <p style={{ color: '#666', marginBottom: 24 }}>
              请设置您的新密码（至少8个字符，必须包含字母和数字）
            </p>

            <Form.Item
              name="new_password"
              rules={[
                { required: true, message: '请输入新密码!' },
                { min: 8, message: '密码至少8个字符!' },
                {
                  pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
                  message: '密码必须包含字母和数字!'
                }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="新密码"
              />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              dependencies={['new_password']}
              rules={[
                { required: true, message: '请确认新密码!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致!'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="确认新密码"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ width: '100%' }}
              >
                重置密码
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => setCurrentStep(0)}>
                返回上一步
              </Button>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;