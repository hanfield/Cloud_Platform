/**
 * 个人信息页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Avatar, Divider, Row, Col, Modal, Table, Tag } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  LockOutlined,
  CameraOutlined,
  SaveOutlined,
  HistoryOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { formatDateTime } from '../utils/helpers';

const Profile = () => {
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({
    username: 'admin',
    email: 'admin@cloudplatform.com',
    phone: '13800138000',
    firstName: '管理员',
    lastName: '系统',
    department: 'IT部门',
    position: '系统管理员',
    avatar: null,
    joinDate: '2024-01-01',
    lastLogin: new Date().toISOString()
  });

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginHistoryVisible, setLoginHistoryVisible] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // 模拟登录历史数据
  const [loginHistory] = useState([
    {
      id: 1,
      loginTime: '2024-12-26 10:30:00',
      ip: '192.168.1.100',
      device: 'Chrome 120.0 on Windows',
      location: '北京市',
      status: 'success'
    },
    {
      id: 2,
      loginTime: '2024-12-25 15:20:00',
      ip: '192.168.1.100',
      device: 'Chrome 120.0 on Windows',
      location: '北京市',
      status: 'success'
    },
    {
      id: 3,
      loginTime: '2024-12-24 09:15:00',
      ip: '192.168.1.101',
      device: 'Firefox 121.0 on Mac',
      location: '上海市',
      status: 'success'
    }
  ]);

  useEffect(() => {
    // 从localStorage获取用户信息
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setUserInfo(prevState => ({
          ...prevState,
          ...user
        }));
        form.setFieldsValue(user);
      } catch (error) {
        console.error('Failed to parse user info:', error);
      }
    }
  }, [form]);

  // 更新个人信息
  const handleUpdateProfile = async (values) => {
    setLoading(true);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedUser = {
        ...userInfo,
        ...values
      };

      setUserInfo(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      message.success('个人信息更新成功');
    } catch (error) {
      message.error('更新失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 修改密码
  const handleChangePassword = async (values) => {
    setLoading(true);
    try {
      // 验证旧密码
      if (values.oldPassword === values.newPassword) {
        message.warning('新密码不能与旧密码相同');
        return;
      }

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      message.success('密码修改成功，请重新登录');
      passwordForm.resetFields();
      setPasswordVisible(false);

      // 实际应用中应该清除token并跳转到登录页
      // localStorage.removeItem('access_token');
      // window.location.href = '/login';
    } catch (error) {
      message.error('修改密码失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 上传头像
  const handleAvatarUpload = (info) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      // 获取上传后的URL
      const avatarUrl = info.file.response?.url || URL.createObjectURL(info.file.originFileObj);
      setUserInfo({
        ...userInfo,
        avatar: avatarUrl
      });
      setLoading(false);
      message.success('头像上传成功');
    }
  };

  // 自定义上传
  const customUpload = ({ file, onSuccess }) => {
    setTimeout(() => {
      onSuccess({ url: URL.createObjectURL(file) });
    }, 1000);
  };

  // 登录历史表格列
  const loginHistoryColumns = [
    {
      title: '登录时间',
      dataIndex: 'loginTime',
      key: 'loginTime',
      render: (text) => formatDateTime(text)
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip'
    },
    {
      title: '设备信息',
      dataIndex: 'device',
      key: 'device'
    },
    {
      title: '登录地点',
      dataIndex: 'location',
      key: 'location'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'success' ? 'success' : 'error'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <UserOutlined className="page-title-icon" />
          个人信息
        </h1>
        <p className="page-description">查看和编辑您的个人信息</p>
      </div>

      <Row gutter={24}>
        {/* 左侧：头像和基本信息 */}
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  size={120}
                  icon={<UserOutlined />}
                  src={userInfo.avatar}
                  style={{ border: '4px solid #f0f0f0' }}
                />
                <Upload
                  showUploadList={false}
                  customRequest={customUpload}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                >
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<CameraOutlined />}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0
                    }}
                  />
                </Upload>
              </div>

              <h2 style={{ marginTop: 20, marginBottom: 5 }}>
                {userInfo.firstName} {userInfo.lastName}
              </h2>
              <p style={{ color: '#8c8c8c', marginBottom: 0 }}>@{userInfo.username}</p>
              <p style={{ color: '#8c8c8c' }}>{userInfo.position}</p>

              <Divider />

              <div style={{ textAlign: 'left' }}>
                <div style={{ marginBottom: 12 }}>
                  <MailOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  <span>{userInfo.email}</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <PhoneOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  <span>{userInfo.phone}</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  <span>{userInfo.department}</span>
                </div>
              </div>

              <Divider />

              <div style={{ textAlign: 'left', fontSize: 12, color: '#8c8c8c' }}>
                <div style={{ marginBottom: 8 }}>
                  入职时间: {userInfo.joinDate}
                </div>
                <div>
                  最后登录: {formatDateTime(userInfo.lastLogin)}
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ marginTop: 16 }} title="快捷操作">
            <Button
              block
              icon={<LockOutlined />}
              onClick={() => setPasswordVisible(true)}
              style={{ marginBottom: 12 }}
            >
              修改密码
            </Button>
            <Button
              block
              icon={<HistoryOutlined />}
              onClick={() => setLoginHistoryVisible(true)}
            >
              登录历史
            </Button>
          </Card>
        </Col>

        {/* 右侧：详细信息编辑 */}
        <Col xs={24} lg={16}>
          <Card title="编辑个人信息">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdateProfile}
              initialValues={userInfo}
            >
              <Divider orientation="left">基本信息</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input prefix={<UserOutlined />} disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="邮箱"
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入正确的邮箱格式' }
                    ]}
                  >
                    <Input prefix={<MailOutlined />} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="姓"
                    name="lastName"
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="名"
                    name="firstName"
                  >
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="手机号码"
                name="phone"
                rules={[
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' }
                ]}
              >
                <Input prefix={<PhoneOutlined />} />
              </Form.Item>

              <Divider orientation="left">工作信息</Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="部门"
                    name="department"
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="职位"
                    name="position"
                  >
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                  保存修改
                </Button>
                <Button style={{ marginLeft: 8 }} onClick={() => form.resetFields()}>
                  重置
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="安全设置" style={{ marginTop: 16 }}>
            <div style={{ padding: '20px 0' }}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>
                        <SafetyOutlined style={{ marginRight: 8 }} />
                        账户密码
                      </div>
                      <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                        定期更改密码可以提高账户安全性
                      </div>
                    </div>
                    <Button type="link" onClick={() => setPasswordVisible(true)}>
                      修改
                    </Button>
                  </div>
                </Col>

                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>
                        <HistoryOutlined style={{ marginRight: 8 }} />
                        登录历史
                      </div>
                      <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                        查看最近的登录记录
                      </div>
                    </div>
                    <Button type="link" onClick={() => setLoginHistoryVisible(true)}>
                      查看
                    </Button>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={passwordVisible}
        onCancel={() => {
          setPasswordVisible(false);
          passwordForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            label="当前密码"
            name="oldPassword"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少8位' },
              { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '密码必须包含大小写字母和数字' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>

          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 16 }}>
            密码要求：
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>至少8个字符</li>
              <li>包含大写字母</li>
              <li>包含小写字母</li>
              <li>包含数字</li>
            </ul>
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 登录历史弹窗 */}
      <Modal
        title="登录历史"
        open={loginHistoryVisible}
        onCancel={() => setLoginHistoryVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          columns={loginHistoryColumns}
          dataSource={loginHistory}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
};

export default Profile;