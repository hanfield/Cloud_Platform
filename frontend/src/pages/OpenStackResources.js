/**
 * OpenStack资源页面
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, message, Spin } from 'antd';
import {
  CloudServerOutlined,
  DatabaseOutlined,
  PictureOutlined,
  ApiOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import openstackService from '../services/openstackService';
import { formatDate } from '../utils/helpers';

const OpenStackResources = () => {
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [summary, setSummary] = useState({});
  const [servers, setServers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [images, setImages] = useState([]);
  const [flavors, setFlavors] = useState([]);

  useEffect(() => {
    checkConnection();
    fetchData();
  }, []);

  // 检查OpenStack连接
  const checkConnection = async () => {
    try {
      const response = await openstackService.checkConnection();
      setConnectionStatus(response.connected);
      if (!response.connected) {
        message.warning('OpenStack连接异常');
      }
    } catch (error) {
      setConnectionStatus(false);
      message.error('无法连接到OpenStack');
    }
  };

  // 获取所有数据
  const fetchData = async () => {
    setLoading(true);
    try {
      // 获取资源总览
      const summaryData = await openstackService.getResourcesSummary();
      setSummary(summaryData);

      // 获取服务器列表
      const serversData = await openstackService.servers.list();
      setServers(serversData.slice(0, 10)); // 只显示前10条

      // 获取项目列表
      const projectsData = await openstackService.projects.list();
      setProjects(projectsData.slice(0, 10));

      // 获取镜像列表
      const imagesData = await openstackService.images.list();
      setImages(imagesData.slice(0, 10));

      // 获取规格列表
      const flavorsData = await openstackService.flavors.list();
      setFlavors(flavorsData.slice(0, 10));

    } catch (error) {
      message.error('获取OpenStack资源失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    checkConnection();
    fetchData();
  };

  // 服务器表格列
  const serverColumns = [
    {
      title: '服务器名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => text.substring(0, 8) + '...'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'ACTIVE' ? 'success' : status === 'BUILD' ? 'processing' : 'default'}>
          {status}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created',
      key: 'created',
      render: (date) => formatDate(date)
    }
  ];

  // 项目表格列
  const projectColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => text.substring(0, 8) + '...'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || '-'
    },
    {
      title: '启用状态',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? '已启用' : '已禁用'}
        </Tag>
      )
    }
  ];

  // 镜像表格列
  const imageColumns = [
    {
      title: '镜像名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (text) => text.substring(0, 8) + '...'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status}
        </Tag>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => size ? `${(size / 1024 / 1024 / 1024).toFixed(2)} GB` : '-'
    }
  ];

  // 规格表格列
  const flavorColumns = [
    {
      title: '规格名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: 'vCPU',
      dataIndex: 'vcpus',
      key: 'vcpus',
      render: (vcpus) => `${vcpus} 核`
    },
    {
      title: '内存',
      dataIndex: 'ram',
      key: 'ram',
      render: (ram) => `${(ram / 1024).toFixed(1)} GB`
    },
    {
      title: '磁盘',
      dataIndex: 'disk',
      key: 'disk',
      render: (disk) => `${disk} GB`
    }
  ];

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CloudServerOutlined className="page-title-icon" />
            OpenStack资源管理
          </h1>
          <p className="page-description">查看和管理OpenStack云平台资源</p>
        </div>
        <div>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} style={{ marginRight: 8 }}>
            刷新
          </Button>
          <Tag
            icon={connectionStatus ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={connectionStatus ? 'success' : 'error'}
          >
            {connectionStatus ? '连接正常' : '连接异常'}
          </Tag>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="项目数"
              value={summary.projects_count || 0}
              prefix={<ApiOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务器数"
              value={summary.servers_count || 0}
              prefix={<DatabaseOutlined />}
              suffix="台"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="镜像数"
              value={summary.images_count || 0}
              prefix={<PictureOutlined />}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="网络数"
              value={summary.networks_count || 0}
              prefix={<ApiOutlined />}
              suffix="个"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 资源表格 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card title="服务器列表" extra={<Button type="link">查看全部</Button>}>
            <Table
              columns={serverColumns}
              dataSource={servers}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="项目列表" extra={<Button type="link">查看全部</Button>}>
            <Table
              columns={projectColumns}
              dataSource={projects}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="镜像列表" extra={<Button type="link">查看全部</Button>}>
            <Table
              columns={imageColumns}
              dataSource={images}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="规格列表" extra={<Button type="link">查看全部</Button>}>
            <Table
              columns={flavorColumns}
              dataSource={flavors}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OpenStackResources;