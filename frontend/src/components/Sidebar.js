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
  FileTextOutlined,
  SettingOutlined,
  DesktopOutlined,
  ShoppingOutlined,
  ToolOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // 菜单项配置
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板'
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
      key: '/contracts',
      icon: <FileTextOutlined />,
      label: '合同管理'
    },
    {
      key: '/information-systems',
      icon: <DesktopOutlined />,
      label: '信息系统管理'
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
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置'
    }
  ];

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
      theme="dark"
    >
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={openKeys}
        items={menuItems}
        onClick={handleMenuClick}
        className="sidebar-menu"
      />
    </Sider>
  );
};

export default Sidebar;