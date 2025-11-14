import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Tabs, Table, Button, message } from 'antd';
import { CloudOutlined, DatabaseOutlined, HddOutlined, GlobalOutlined, ReloadOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import cloudService from '../services/cloudService';

const { TabPane } = Tabs;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const CloudResources = () => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [servers, setServers] = useState([]);
  const [images, setImages] = useState([]);
  const [networks, setNetworks] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const overviewRes = await cloudService.getCloudOverview();
      setOverview(overviewRes.data);
      const serversRes = await cloudService.getServers();
      setServers(Array.isArray(serversRes.data) ? serversRes.data : []);
      const imagesRes = await cloudService.getImages();
      setImages(Array.isArray(imagesRes.data) ? imagesRes.data : []);
      const networksRes = await cloudService.getNetworks();
      setNetworks(Array.isArray(networksRes.data) ? networksRes.data : []);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const pieData = overview ? [
    { name: '运行中', value: overview.compute?.running_instances || 0 },
    { name: '已停止', value: overview.compute?.stopped_instances || 0 }
  ] : [];

  return (
    <div style={{ padding: '24px' }}>
      <Card title={<span><CloudOutlined /> 云资源管理</span>} extra={<Button icon={<ReloadOutlined />} onClick={fetchAllData}>刷新</Button>}>
        {overview && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}><Card><Statistic title="计算实例" value={overview.compute?.total_instances || 0} /></Card></Col>
              <Col span={6}><Card><Statistic title="运行中" value={overview.compute?.running_instances || 0} /></Card></Col>
              <Col span={6}><Card><Statistic title="镜像" value={overview.images?.total || 0} /></Card></Col>
              <Col span={6}><Card><Statistic title="网络" value={overview.networks?.total || 0} /></Card></Col>
            </Row>
            <Card title="实例状态分布" style={{ marginBottom: 24 }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}
        <Tabs>
          <TabPane tab="计算实例" key="1">
            <Table dataSource={servers} rowKey="id" loading={loading} columns={[
              { title: '名称', dataIndex: 'name' },
              { title: 'ID', dataIndex: 'id', ellipsis: true },
              { title: '状态', dataIndex: 'status' }
            ]} />
          </TabPane>
          <TabPane tab="镜像管理" key="2">
            <Table dataSource={images} rowKey="id" loading={loading} columns={[
              { title: '名称', dataIndex: 'name' },
              { title: 'ID', dataIndex: 'id', ellipsis: true }
            ]} />
          </TabPane>
          <TabPane tab="网络管理" key="3">
            <Table dataSource={networks} rowKey="id" loading={loading} columns={[
              { title: '名称', dataIndex: 'name' },
              { title: 'ID', dataIndex: 'id', ellipsis: true }
            ]} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default CloudResources;
