/**
 * 主应用组件
 */

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppHeader from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TenantManagement from './pages/TenantManagement';
import ContractManagement from './pages/ContractManagement';
import OpenStackResources from './pages/OpenStackResources';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import './styles/main.css';
import 'moment/locale/zh-cn';

const { Content } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <div className="app-container">
          <AppHeader collapsed={collapsed} onToggle={toggleCollapsed} />

          <Layout className="main-layout">
            <Sidebar collapsed={collapsed} />

            <Content className="content-area">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tenants" element={<TenantManagement />} />
                <Route path="/contracts" element={<ContractManagement />} />
                <Route path="/openstack/overview" element={<OpenStackResources />} />
                <Route path="/openstack/servers" element={<OpenStackResources />} />
                <Route path="/openstack/projects" element={<OpenStackResources />} />
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