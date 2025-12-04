import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Descriptions, Button, Table, Form, Input, message, Popconfirm, Tag, Space, DatePicker, Select } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CameraOutlined, LineChartOutlined, InfoCircleOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import request from '../services/api';
import moment from 'moment';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const VMDetailModal = ({ visible, vm, onClose, onRefresh }) => {
    const [activeTab, setActiveTab] = useState('1');
    const [snapshots, setSnapshots] = useState([]);
    const [snapshotsLoading, setSnapshotsLoading] = useState(false);
    const [metrics, setMetrics] = useState([]);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [timeRange, setTimeRange] = useState('24h');
    const [createSnapshotVisible, setCreateSnapshotVisible] = useState(false);
    const [snapshotForm] = Form.useForm();

    useEffect(() => {
        if (visible && vm) {
            // 初始化时都不自动加载，减少请求
            // 切换Tab时再加载
        }
    }, [visible, vm]);

    // 当Tab切换时加载对应数据
    useEffect(() => {
        if (!visible || !vm) return;

        if (activeTab === '2') {
            fetchSnapshots();
        } else if (activeTab === '3') {
            fetchMetrics();
        }
    }, [activeTab, visible, vm]);

    // 获取快照列表
    const fetchSnapshots = async () => {
        if (!vm || !vm.id) return;

        setSnapshotsLoading(true);
        try {
            const data = await request.get(`/information-systems/snapshots/?virtual_machine=${vm.id}`);
            // 确保数据是数组格式
            setSnapshots(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('获取快照列表失败:', error);
            message.error('获取快照列表失败');
            setSnapshots([]); // 错误时设置为空数组
        } finally {
            setSnapshotsLoading(false);
        }
    };

    // 获取监控数据
    const fetchMetrics = async () => {
        if (!vm || !vm.id) return;

        setMetricsLoading(true);
        try {
            const data = await request.get(`/monitoring/vm-history/?vm_id=${vm.id}&range=${timeRange}`);
            // 确保数据是数组格式
            setMetrics(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('获取监控数据失败:', error);
            message.error('获取监控数据失败');
            setMetrics([]); // 错误时设置为空数组
        } finally {
            setMetricsLoading(false);
        }
    };

    // 创建快照
    const handleCreateSnapshot = async () => {
        try {
            const values = await snapshotForm.validateFields();
            await request.post('/information-systems/snapshots/', {
                virtual_machine: vm.id,
                name: values.name,
                description: values.description || ''
            });
            message.success('快照创建请求已提交，请稍候刷新查看');
            setCreateSnapshotVisible(false);
            snapshotForm.resetFields();
            fetchSnapshots();
            if (onRefresh) onRefresh();
        } catch (error) {
            message.error('创建快照失败: ' + (error.response?.data?.error || '未知错误'));
        }
    };

    // 回滚快照
    const handleRestoreSnapshot = async (snapshotId) => {
        try {
            await request.post(`/information-systems/snapshots/${snapshotId}/restore/`);
            message.success('快照回滚请求已提交，虚拟机将重启');
            fetchSnapshots();
            if (onRefresh) onRefresh();
        } catch (error) {
            message.error('回滚失败: ' + (error.response?.data?.error || '未知错误'));
        }
    };

    // 删除快照
    const handleDeleteSnapshot = async (snapshotId) => {
        try {
            await request.delete(`/information-systems/snapshots/${snapshotId}/`);
            message.success('快照删除成功');
            fetchSnapshots();
        } catch (error) {
            message.error('删除失败');
        }
    };

    // 快照列表列配置
    const snapshotColumns = [
        {
            title: '快照名称',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            render: (text) => text || '-'
        },
        {
            title: '大小',
            dataIndex: 'size_gb',
            key: 'size_gb',
            render: (size) => size ? `${size}GB` : '-'
        },
        {
            title: '状态',
            dataIndex: 'status_display',
            key: 'status',
            render: (text, record) => {
                const colorMap = {
                    'creating': 'processing',
                    'available': 'success',
                    'restoring': 'warning',
                    'deleting': 'default',
                    'error': 'error'
                };
                return <Tag color={colorMap[record.status] || 'default'}>{text}</Tag>;
            }
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: '创建者',
            dataIndex: 'created_by_name',
            key: 'created_by_name',
            render: (name) => name || '-'
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    {record.status === 'available' && (
                        <Popconfirm
                            title="回滚快照会重启虚拟机，确定继续吗？"
                            onConfirm={() => handleRestoreSnapshot(record.id)}
                        >
                            <Button type="link" icon={<RollbackOutlined />} size="small">回滚</Button>
                        </Popconfirm>
                    )}
                    <Popconfirm
                        title="确定删除此快照吗？"
                        onConfirm={() => handleDeleteSnapshot(record.id)}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />} size="small">删除</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // 格式化监控数据用于图表显示
    const formatMetricsForChart = () => {
        return metrics.map(m => ({
            time: moment(m.timestamp).format('HH:mm'),
            CPU: parseFloat(m.cpu_usage).toFixed(1),
            内存: parseFloat(m.memory_usage).toFixed(1),
            网络入: parseFloat(m.network_in).toFixed(1),
            网络出: parseFloat(m.network_out).toFixed(1)
        }));
    };

    // 基本信息Tab
    const renderBasicInfo = () => {
        // 兼容不同API返回的字段名
        // 租户门户API返回: cpu, memory, disk, ip
        // 标准API返回: cpu_cores, memory_gb, disk_gb, ip_address
        const cpuCores = vm?.cpu_cores || vm?.cpu;
        const memoryGb = vm?.memory_gb || vm?.memory;
        const diskGb = vm?.disk_gb || vm?.disk;
        const ipAddress = vm?.ip_address || vm?.ip;
        const uptime = vm?.uptime_display || vm?.uptime;

        return (
            <Descriptions bordered column={2}>
                <Descriptions.Item label="虚拟机名称">{vm?.name}</Descriptions.Item>
                <Descriptions.Item label="IP地址">{ipAddress || '未分配'}</Descriptions.Item>
                <Descriptions.Item label="CPU核数">{cpuCores ? `${cpuCores}核` : '-'}</Descriptions.Item>
                <Descriptions.Item label="内存">{memoryGb ? `${memoryGb}GB` : '-'}</Descriptions.Item>
                <Descriptions.Item label="磁盘">{diskGb ? `${diskGb}GB` : '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                    <Tag color={vm?.status === 'running' ? 'green' : 'red'}>{vm?.status_display}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="数据中心">{vm?.data_center_type_display || '-'}</Descriptions.Item>
                <Descriptions.Item label="可用区">{vm?.availability_zone || '-'}</Descriptions.Item>
                <Descriptions.Item label="操作系统">{vm?.os_type || '未知'}</Descriptions.Item>
                <Descriptions.Item label="运行时长">{uptime || '未运行'}</Descriptions.Item>
                <Descriptions.Item label="创建时间" span={2}>
                    {vm?.created_at ? moment(vm.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
            </Descriptions>
        );
    };

    // 快照管理Tab
    const renderSnapshotTab = () => (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button
                    type="primary"
                    icon={<CameraOutlined />}
                    onClick={() => setCreateSnapshotVisible(true)}
                >
                    创建快照
                </Button>
            </div>
            <Table
                columns={snapshotColumns}
                dataSource={snapshots}
                rowKey="id"
                loading={snapshotsLoading}
                pagination={{ pageSize: 10 }}
            />

            <Modal
                title="创建虚拟机快照"
                visible={createSnapshotVisible}
                onOk={handleCreateSnapshot}
                onCancel={() => {
                    setCreateSnapshotVisible(false);
                    snapshotForm.resetFields();
                }}
                okText="创建"
                cancelText="取消"
            >
                <Form form={snapshotForm} layout="vertical">
                    <Form.Item
                        name="name"
                        label="快照名称"
                        rules={[{ required: true, message: '请输入快照名称' }]}
                    >
                        <Input placeholder="例如: snapshot-before-upgrade" />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <TextArea rows={3} placeholder="可选：记录快照用途" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );

    // 监控图表Tab
    const renderMonitoringTab = () => {
        const chartData = formatMetricsForChart();

        return (
            <div>
                <div style={{ marginBottom: 16 }}>
                    <Space>
                        <span>时间范围：</span>
                        <Select value={timeRange} onChange={(val) => { setTimeRange(val); }} style={{ width: 120 }}>
                            <Option value="1h">最近1小时</Option>
                            <Option value="24h">最近24小时</Option>
                            <Option value="7d">最近7天</Option>
                        </Select>
                        <Button onClick={fetchMetrics}>刷新</Button>
                    </Space>
                </div>

                {metricsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
                ) : chartData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        <LineChartOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                        <p>暂无监控数据</p>
                        <p style={{ fontSize: 12 }}>监控数据每5分钟采集一次，请等待片刻</p>
                    </div>
                ) : (
                    <div>
                        <h4>CPU & 内存使用率 (%)</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="CPU" stroke="#1890ff" strokeWidth={2} />
                                <Line type="monotone" dataKey="内存" stroke="#52c41a" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>

                        <h4 style={{ marginTop: 24 }}>网络流量 (KB/s)</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="网络入" stroke="#faad14" strokeWidth={2} />
                                <Line type="monotone" dataKey="网络出" stroke="#eb2f96" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal
            title={`虚拟机详情: ${vm?.name || ''}`}
            visible={visible}
            onCancel={onClose}
            width={900}
            footer={[
                <Button key="close" onClick={onClose}>关闭</Button>
            ]}
        >
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane
                    tab={<span><InfoCircleOutlined />基本信息</span>}
                    key="1"
                >
                    {renderBasicInfo()}
                </TabPane>
                <TabPane
                    tab={<span><CameraOutlined />快照管理</span>}
                    key="2"
                >
                    {renderSnapshotTab()}
                </TabPane>
                <TabPane
                    tab={<span><LineChartOutlined />资源监控</span>}
                    key="3"
                >
                    {renderMonitoringTab()}
                </TabPane>
            </Tabs>
        </Modal>
    );
};

export default VMDetailModal;
