/**
 * 侧边栏组件
 */

import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  DesktopOutlined,
  ShoppingOutlined,
  ToolOutlined,
  HomeOutlined,
  AppstoreOutlined,
  ShopOutlined,
  FileTextOutlined,
  PayCircleOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // 获取用户类型
  const userType = localStorage.getItem('user_type') || 'admin';

  // 管理员菜单项配置
  const adminMenuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '主页'
    },
    {
      key: '/tenants',
      icon: <TeamOutlined />,
      label: '租户管理'
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理'
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: '产品管理'
    },
    {
      key: '/services',
      icon: <ToolOutlined />,
      label: '服务管理'
    },
    {
      key: '/assets',
      icon: <ToolOutlined />,
      label: '资产管理'
    },
    {
      key: '/cloud-resources',
      icon: <DesktopOutlined />,
      label: '云资源管理'
    }
  ];

  // 租户用户菜单项配置
  const tenantMenuItems = [
    {
      key: '/tenant-portal',
      icon: <HomeOutlined />,
      label: '首页'
    },
    {
      key: '/tenant-info',
      icon: <TeamOutlined />,
      label: '租户信息'
    },
    {
      key: '/tenant-systems',
      icon: <DesktopOutlined />,
      label: '我的系统'
    },
    {
      key: '/tenant-products',
      icon: <ShopOutlined />,
      label: '产品订阅'
    },
    {
      key: '/tenant-billing',
      icon: <PayCircleOutlined />,
      label: '账单管理'
    },
    {
      key: '/tenant-orders',
      icon: <AppstoreOutlined />,
      label: '订单管理'
    }
  ];

  // 根据用户类型选择菜单项
  const menuItems = userType === 'tenant' ? tenantMenuItems : adminMenuItems;

  // 处理菜单点击
  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 获取当前选中的菜单key
  const selectedKey = location.pathname;

  // 获取当前打开的子菜单key
  const openKeys = menuItems
    .filter(item => item.children && item.children.some(child => selectedKey.startsWith(child.key)))
    .map(item => item.key);

  return (
    <Sider
      className="app-sidebar"
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={240}
      theme="light"
      style={{
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        zIndex: 99,
        background: 'rgba(255, 255, 255, 0.7)', // Light glass
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'fixed',
        left: 16,
        top: 96, // 16px margin + 64px header + 16px gap
        bottom: 16,
        overflowY: 'auto',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}
    >
      <Menu
        theme="light"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={openKeys}
        items={menuItems}
        onClick={handleMenuClick}
        className="sidebar-menu"
        style={{ paddingTop: 8 }}
      />
    </Sider>
  );
};

export default Sidebar;