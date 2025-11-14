/**
 * 头部组件
 */

import React, { useState } from 'react';
import { Layout, Avatar, Dropdown, Space, Button, message } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  CloudOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Header } = Layout;

const AppHeader = ({ collapsed, onToggle }) => {
  const navigate = useNavigate();
  const [user] = useState(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : { username: 'Admin' };
  });

  // 用户菜单项
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/profile')
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings')
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_type');
    message.success('已退出登录');
    navigate('/login', { replace: true });
    window.location.reload();
  }

  const handleLogoClick = () => {
    const userType = localStorage.getItem('user_type');
    if (userType === 'tenant') {
      navigate('/tenant-portal');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <Header className="app-header">
      <div className="header-content">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggle}
            style={{
              fontSize: '16px',
              width: 48,
              height: 48,
              color: '#fff',
              marginRight: 16
            }}
          />
          <div
            className="header-logo"
            onClick={handleLogoClick}
            style={{ cursor: 'pointer' }}
          >
            <CloudOutlined className="header-logo-icon" />
            <span>云平台管理系统</span>
          </div>
        </div>

        <div className="header-actions">
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="header-user">
              <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <span>{user.username}</span>
            </div>
          </Dropdown>
        </div>
      </div>
    </Header>
  );
};

export default AppHeader;