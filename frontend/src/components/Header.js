/**
 * 头部组件
 */

import React, { useState, useEffect } from 'react';
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
  const [user, setUser] = useState({ username: 'Admin', user_type: 'admin' });
  const [systemName, setSystemName] = useState('云平台管理系统');

  // 加载系统名称
  useEffect(() => {
    fetchSystemName();
  }, []);

  // 监听系统配置更新
  useEffect(() => {
    const handleConfigUpdate = (event) => {
      if (event.detail && event.detail.systemName) {
        setSystemName(event.detail.systemName);
      }
    };

    window.addEventListener('systemConfigUpdated', handleConfigUpdate);
    return () => {
      window.removeEventListener('systemConfigUpdated', handleConfigUpdate);
    };
  }, []);

  const fetchSystemName = async () => {
    try {
      const response = await fetch('/api/system/settings/category/?name=system', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings && data.settings.systemName) {
          setSystemName(data.settings.systemName);
        }
      }
    } catch (error) {
      console.error('Failed to load system name:', error);
    }
  };

  // 监听localStorage变化，更新用户信息
  useEffect(() => {
    const updateUserInfo = () => {
      const userData = localStorage.getItem('user');
      const userType = localStorage.getItem('user_type') || 'admin';
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser({ ...parsed, user_type: userType });
      }
    };

    // 初始加载
    updateUserInfo();

    // 监听storage事件
    window.addEventListener('storage', updateUserInfo);

    return () => {
      window.removeEventListener('storage', updateUserInfo);
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_type');
    message.success('已退出登录');
    navigate('/login', { replace: true });
    window.location.reload();
  }

  // 根据用户类型生成菜单项
  const getUserMenuItems = () => {
    const items = [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: '个人信息',
        onClick: () => navigate('/profile')
      }
    ];

    // 只有管理员才显示系统设置
    if (user.user_type === 'admin') {
      items.push({
        key: 'settings',
        icon: <SettingOutlined />,
        label: '系统设置',
        onClick: () => navigate('/settings')
      });
    }

    items.push(
      {
        type: 'divider'
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout
      }
    );

    return items;
  };

  const handleLogoClick = () => {
    const userType = localStorage.getItem('user_type');
    if (userType === 'tenant') {
      navigate('/tenant-portal');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <Header
      className="app-header glass-effect"
      style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '0 24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        position: 'fixed',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}
    >
      <div className="header-left" style={{ display: 'flex', alignItems: 'center' }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{
            fontSize: '16px',
            width: 32,
            height: 32,
            marginRight: 16
          }}
        />
        <div
          className="header-logo"
          onClick={handleLogoClick}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1668dc'
          }}
        >
          <CloudOutlined style={{ fontSize: '24px', marginRight: 8 }} />
          <span>{systemName}</span>
        </div>
      </div>

      <div className="header-right">
        <Space size="middle">
          <Dropdown menu={{ items: getUserMenuItems() }} placement="bottomRight">
            <div className="header-user" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Avatar
                icon={<UserOutlined />}
                style={{
                  backgroundColor: '#e6f4ff',
                  color: '#1668dc',
                  marginRight: 8
                }}
              />
              <span style={{ fontWeight: 500 }}>{user.username}</span>
            </div>
          </Dropdown>
        </Space>
      </div>
    </Header>
  );
};

export default AppHeader;