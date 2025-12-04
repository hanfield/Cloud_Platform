/**
 * 主应用组件
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppHeader from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import TenantManagement from './pages/TenantManagement';
import UserManagement from './pages/UserManagement';
import ContractManagement from './pages/ContractManagement';
import InformationSystemManagement from './pages/InformationSystemManagement';
import ProductManagement from './pages/ProductManagement';
import ServiceManagement from './pages/ServiceManagement';
import AssetManagement from './pages/AssetManagement';
import CloudResources from './pages/CloudResources';
import TenantPortal from './pages/TenantPortal';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import BillingManagement from './pages/BillingManagement';
import OrderManagement from './pages/OrderManagement';
import TenantBilling from './pages/TenantBilling';
import TenantOrders from './pages/TenantOrders';
import './styles/main.css';
import 'moment/locale/zh-cn';

const { Content } = Layout;

// 认证检查组件（目前未使用，保留以备将来需要）
// const ProtectedRoute = ({ children }) => {
//   const token = localStorage.getItem('access_token');
//   return token ? children : <Navigate to="/login" replace />;
// };

function App() {
  const [collapsed, setCollapsed] = useState(false);
  // 直接从 localStorage 初始化状态，避免刷新时短暂的未认证状态导致重定向
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('access_token'));
  const [userType, setUserType] = useState(localStorage.getItem('user_type') || 'admin');

  useEffect(() => {
    // 监听 storage 变化以处理多标签页同步
    const handleStorageChange = () => {
      const token = localStorage.getItem('access_token');
      const storedUserType = localStorage.getItem('user_type') || 'admin';
      setIsAuthenticated(!!token);
      setUserType(storedUserType);
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // 如果未认证，显示登录或注册页面
  if (!isAuthenticated) {
    return (
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            colorBgLayout: '#f0f2f5',
          },
        }}
      >
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ConfigProvider>
    );
  }

  if (userType === 'tenant') {
    return (
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            colorBgLayout: '#f0f2f5',
          },
        }}
      >
        <Router>
          <div className="app-container">
            <AppHeader collapsed={collapsed} onToggle={toggleCollapsed} />
            <Layout className="main-layout">
              <Sidebar collapsed={collapsed} />
              <Content
                className={`content-area ${collapsed ? 'sidebar-collapsed' : ''}`}
                style={{
                  marginTop: 96,
                  marginLeft: collapsed ? 96 : 272,
                  transition: 'all 0.2s',
                  paddingRight: 16
                }}
              >
                <Routes>
                  <Route path="/" element={<Navigate to="/tenant-portal" replace />} />
                  <Route path="/login" element={<Navigate to="/tenant-portal" replace />} />
                  <Route path="/tenant-portal" element={<TenantPortal />} />
                  <Route path="/tenant-info" element={<TenantPortal />} />
                  <Route path="/tenant-systems" element={<TenantPortal />} />
                  <Route path="/tenant-products" element={<TenantPortal />} />
                  <Route path="/tenant-billing" element={<TenantBilling />} />
                  <Route path="/tenant-orders" element={<TenantOrders />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/tenant-portal" replace />} />
                </Routes>
              </Content>
            </Layout>
          </div>
        </Router>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1668dc', // Deep corporate blue
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          colorBgLayout: '#e6eff7', // Darker cool gray-blue background
          colorTextHeading: '#1f1f1f',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
        components: {
          Card: {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            borderRadiusLG: 12,
          },
          Button: {
            borderRadius: 6,
            controlHeight: 36,
          },
          Menu: {
            itemBorderRadius: 6,
            itemSelectedBg: '#e6f4ff',
            itemSelectedColor: '#1668dc',
          },
          Layout: {
            siderBg: '#ffffff',
            headerBg: '#ffffff',
          }
        }
      }}
    >
      <Router>
        <div className="app-container">
          <AppHeader collapsed={collapsed} onToggle={toggleCollapsed} />

          <Layout className="main-layout">
            <Sidebar collapsed={collapsed} />

            <Content
              className={`content-area ${collapsed ? 'sidebar-collapsed' : ''}`}
              style={{
                marginTop: 96, // 16px + 64px + 16px
                marginLeft: collapsed ? 96 : 272, // 16px + width + 16px
                transition: 'all 0.2s',
                paddingRight: 16 // Add right padding to balance
              }}
            >
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tenants" element={<TenantManagement />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/contracts" element={<ContractManagement />} />
                <Route path="/information-systems" element={<InformationSystemManagement />} />
                <Route path="/products" element={<ProductManagement />} />
                <Route path="/services" element={<ServiceManagement />} />
                <Route path="/assets" element={<AssetManagement />} />
                <Route path="/cloud-resources/*" element={<CloudResources />} />
                <Route path="/billing" element={<BillingManagement />} />
                <Route path="/orders" element={<OrderManagement />} />
                <Route path="/tenant-portal" element={<TenantPortal />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Content>
          </Layout>
        </div>
      </Router>
    </ConfigProvider>
  );
}

export default App;