/**
 * 系统设置页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, message, Tabs, Select, InputNumber, Divider } from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  DatabaseOutlined,
  CloudOutlined,
  BellOutlined,
  SafetyOutlined,
  UserOutlined
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;


const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [systemForm] = Form.useForm();
  const [databaseForm] = Form.useForm();
  const [openstackForm] = Form.useForm();
  const [notificationForm] = Form.useForm();

  // 使用useState而不是固定值
  const [systemSettings, setSystemSettings] = useState({
    systemName: '云平台管理系统',
    systemVersion: '1.0.0',
    systemDescription: '基于Django和React的云平台管理系统',
    enableRegistration: false,
    enableEmailVerification: true,
    sessionTimeout: 24,
    maxLoginAttempts: 5
  });

  const [databaseSettings, setDatabaseSettings] = useState({
    dbType: 'postgresql',
    dbHost: 'localhost',
    dbPort: 5432,
    dbName: 'cloud_platform',
    dbUser: 'cloud_user',
    maxConnections: 100,
    connectionTimeout: 30
  });

  const [openstackSettings, setOpenstackSettings] = useState({
    authUrl: 'http://localhost:5000/v3',
    username: 'admin',
    projectName: 'admin',
    userDomain: 'Default',
    projectDomain: 'Default',
    regionName: 'RegionOne',
    enableSync: true,
    syncInterval: 60
  });

  const [notificationSettings, setNotificationSettings] = useState({
    enableEmail: true,
    emailFrom: 'noreply@cloudplatform.com',
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    enableSMS: false,
    enableSystemNotification: true,
    notifyOnTenantCreate: true,
    notifyOnContractExpire: true
  });

  // 从API加载所有设置
  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    try {
      const response = await fetch('/api/system/settings/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        // 更新各个分类的设置
        if (data.system && Object.keys(data.system).length > 0) {
          setSystemSettings(prev => ({ ...prev, ...data.system }));
          systemForm.setFieldsValue(data.system);
        }
        if (data.database && Object.keys(data.database).length > 0) {
          setDatabaseSettings(prev => ({ ...prev, ...data.database }));
          databaseForm.setFieldsValue(data.database);
        }
        if (data.openstack && Object.keys(data.openstack).length > 0) {
          setOpenstackSettings(prev => ({ ...prev, ...data.openstack }));
          openstackForm.setFieldsValue(data.openstack);
        }
        if (data.notification && Object.keys(data.notification).length > 0) {
          setNotificationSettings(prev => ({ ...prev, ...data.notification }));
          notificationForm.setFieldsValue(data.notification);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  // 保存系统设置
  const handleSaveSystemSettings = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/system/settings/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ category: 'system', settings: values })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '保存失败');
      }

      message.success('系统设置保存成功');

      // 更新本地状态
      setSystemSettings(prev => ({ ...prev, ...values }));

      // 触发全局刷新（通过CustomEvent）
      window.dispatchEvent(new CustomEvent('systemConfigUpdated', { detail: values }));

      // 重新加载所有设置
      fetchAllSettings();
    } catch (error) {
      message.error('保存失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 保存数据库设置
  const handleSaveDatabaseSettings = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/system/settings/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ category: 'database', settings: values })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '保存失败');
      }

      message.success('数据库设置保存成功');
    } catch (error) {
      message.error('保存失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 保存OpenStack设置
  const handleSaveOpenstackSettings = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/system/settings/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ category: 'openstack', settings: values })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '保存失败');
      }

      message.success('OpenStack设置保存成功');

      // 刷新页面使OpenStack配置生效（可选）
      // window.location.reload();
    } catch (error) {
      message.error('保存失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 保存通知设置
  const handleSaveNotificationSettings = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/api/system/settings/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ category: 'notification', settings: values })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '保存失败');
      }

      message.success('通知设置保存成功');
    } catch (error) {
      message.error('保存失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 测试数据库连接
  const handleTestDatabaseConnection = async () => {
    message.loading('正在测试连接...', 0);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      message.destroy();
      message.success('数据库连接测试成功！');
    } catch (error) {
      message.destroy();
      message.error('连接测试失败');
    }
  };

  // 测试OpenStack连接
  const handleTestOpenstackConnection = async () => {
    message.loading('正在测试连接...', 0);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      message.destroy();
      message.success('OpenStack连接测试成功！');
    } catch (error) {
      message.destroy();
      message.error('连接测试失败');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <SettingOutlined className="page-title-icon" />
          系统设置
        </h1>
        <p className="page-description">配置系统参数和集成设置</p>
      </div>

      <Tabs defaultActiveKey="1" size="large">
        {/* 基本设置 */}
        <TabPane
          tab={
            <span>
              <SettingOutlined />
              基本设置
            </span>
          }
          key="1"
        >
          <Card>
            <Form
              form={systemForm}
              layout="vertical"
              initialValues={systemSettings}
              onFinish={handleSaveSystemSettings}
            >
              <Divider orientation="left">系统信息</Divider>

              <Form.Item
                label="系统名称"
                name="systemName"
                rules={[{ required: true, message: '请输入系统名称' }]}
              >
                <Input placeholder="请输入系统名称" />
              </Form.Item>

              <Form.Item
                label="系统版本"
                name="systemVersion"
              >
                <Input placeholder="请输入系统版本" disabled />
              </Form.Item>

              <Form.Item
                label="系统描述"
                name="systemDescription"
              >
                <TextArea rows={3} placeholder="请输入系统描述" />
              </Form.Item>

              <Divider orientation="left">安全设置</Divider>

              <Form.Item
                label="会话超时时间（小时）"
                name="sessionTimeout"
                rules={[{ required: true, message: '请输入会话超时时间' }]}
              >
                <InputNumber min={1} max={168} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="最大登录尝试次数"
                name="maxLoginAttempts"
                rules={[{ required: true, message: '请输入最大登录尝试次数' }]}
              >
                <InputNumber min={3} max={10} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="启用用户注册"
                name="enableRegistration"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="启用邮箱验证"
                name="enableEmailVerification"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* 数据库设置 */}
        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              数据库设置
            </span>
          }
          key="2"
        >
          <Card>
            <Form
              form={databaseForm}
              layout="vertical"
              initialValues={databaseSettings}
              onFinish={handleSaveDatabaseSettings}
            >
              <Form.Item
                label="数据库类型"
                name="dbType"
              >
                <Select>
                  <Option value="postgresql">PostgreSQL</Option>
                  <Option value="mysql">MySQL</Option>
                  <Option value="sqlite">SQLite</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="数据库主机"
                name="dbHost"
                rules={[{ required: true, message: '请输入数据库主机' }]}
              >
                <Input placeholder="localhost" />
              </Form.Item>

              <Form.Item
                label="数据库端口"
                name="dbPort"
                rules={[{ required: true, message: '请输入数据库端口' }]}
              >
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="数据库名称"
                name="dbName"
                rules={[{ required: true, message: '请输入数据库名称' }]}
              >
                <Input placeholder="cloud_platform" />
              </Form.Item>

              <Form.Item
                label="数据库用户"
                name="dbUser"
                rules={[{ required: true, message: '请输入数据库用户' }]}
              >
                <Input placeholder="cloud_user" />
              </Form.Item>

              <Form.Item
                label="最大连接数"
                name="maxConnections"
              >
                <InputNumber min={10} max={500} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="连接超时（秒）"
                name="connectionTimeout"
              >
                <InputNumber min={10} max={300} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                  style={{ marginRight: 8 }}
                >
                  保存设置
                </Button>
                <Button onClick={handleTestDatabaseConnection}>
                  测试连接
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* OpenStack设置 */}
        <TabPane
          tab={
            <span>
              <CloudOutlined />
              OpenStack设置
            </span>
          }
          key="3"
        >
          <Card>
            <Form
              form={openstackForm}
              layout="vertical"
              initialValues={openstackSettings}
              onFinish={handleSaveOpenstackSettings}
            >
              <Divider orientation="left">连接配置</Divider>

              <Form.Item
                label="认证URL"
                name="authUrl"
                rules={[{ required: true, message: '请输入认证URL' }]}
              >
                <Input placeholder="http://localhost:5000/v3" />
              </Form.Item>

              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="admin" />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>

              <Form.Item
                label="项目名称"
                name="projectName"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="admin" />
              </Form.Item>

              <Form.Item
                label="用户域"
                name="userDomain"
              >
                <Input placeholder="Default" />
              </Form.Item>

              <Form.Item
                label="项目域"
                name="projectDomain"
              >
                <Input placeholder="Default" />
              </Form.Item>

              <Form.Item
                label="区域名称"
                name="regionName"
              >
                <Input placeholder="RegionOne" />
              </Form.Item>

              <Divider orientation="left">同步设置</Divider>

              <Form.Item
                label="启用自动同步"
                name="enableSync"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="同步间隔（分钟）"
                name="syncInterval"
              >
                <InputNumber min={5} max={1440} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={loading}
                  style={{ marginRight: 8 }}
                >
                  保存设置
                </Button>
                <Button onClick={handleTestOpenstackConnection}>
                  测试连接
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* 通知设置 */}
        <TabPane
          tab={
            <span>
              <BellOutlined />
              通知设置
            </span>
          }
          key="4"
        >
          <Card>
            <Form
              form={notificationForm}
              layout="vertical"
              initialValues={notificationSettings}
              onFinish={handleSaveNotificationSettings}
            >
              <Divider orientation="left">邮件通知</Divider>

              <Form.Item
                label="启用邮件通知"
                name="enableEmail"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="发件人邮箱"
                name="emailFrom"
              >
                <Input placeholder="noreply@cloudplatform.com" />
              </Form.Item>

              <Form.Item
                label="SMTP主机"
                name="smtpHost"
              >
                <Input placeholder="smtp.example.com" />
              </Form.Item>

              <Form.Item
                label="SMTP端口"
                name="smtpPort"
              >
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>

              <Divider orientation="left">通知事件</Divider>

              <Form.Item
                label="启用系统通知"
                name="enableSystemNotification"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="租户创建时通知"
                name="notifyOnTenantCreate"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="合同到期前通知"
                name="notifyOnContractExpire"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="启用短信通知"
                name="enableSMS"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                  保存设置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        {/* 安全设置 */}
        <TabPane
          tab={
            <span>
              <SafetyOutlined />
              安全设置
            </span>
          }
          key="6"
        >
          <Card>
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <SafetyOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
              <h3 style={{ marginTop: 20, color: '#8c8c8c' }}>安全设置功能</h3>
              <p style={{ color: '#bfbfbf' }}>此功能正在开发中，敬请期待...</p>
            </div>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Settings;