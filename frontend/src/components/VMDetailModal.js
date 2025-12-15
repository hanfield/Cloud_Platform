import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Tabs, Descriptions, Button, Table, Form, Input, message, Popconfirm, Tag, Space, Select, Switch, Typography } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CameraOutlined, LineChartOutlined, InfoCircleOutlined, DeleteOutlined, RollbackOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import request from '../services/api';
import moment from 'moment';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const VMDetailModal = ({ visible, vm, flavors = [], onClose, onRefresh }) => {
    const [activeTab, setActiveTab] = useState('1');
    const [snapshots, setSnapshots] = useState([]);
    const [snapshotsLoading, setSnapshotsLoading] = useState(false);
    const [metrics, setMetrics] = useState([]);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [timeRange, setTimeRange] = useState('4h');

    // 自动刷新相关状态
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30); // 默认30秒
    const [countdown, setCountdown] = useState(30);
    const [lastRefreshTime, setLastRefreshTime] = useState(null);
    const autoRefreshTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);
    const [createSnapshotVisible, setCreateSnapshotVisible] = useState(false);
    const [snapshotForm] = Form.useForm();

    // 图表拖拽平移状态
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [viewOffset, setViewOffset] = useState(0); // 当前视图偏移量（数据点个数）
    const [isViewingLatest, setIsViewingLatest] = useState(true); // 是否正在查看最新数据
    const prevMetricsLengthRef = useRef(0); // 记录上一次数据长度
    const chartContainerRef = useRef(null);

    // 每次打开弹窗时重置到基本信息tab
    useEffect(() => {
        if (visible) {
            setActiveTab('1');
        }
    }, [visible]);

    // 获取快照列表
    const fetchSnapshots = useCallback(async () => {
        // 使用 database_id（如果存在）
        const vmId = vm?.database_id || vm?.id;
        if (!vmId) return;

        setSnapshotsLoading(true);
        try {
            const data = await request.get(`/information-systems/snapshots/?virtual_machine=${vmId}`);
            // 确保数据是数组格式
            setSnapshots(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('获取快照列表失败:', error);
            message.error('获取快照列表失败');
            setSnapshots([]); // 错误时设置为空数组
        } finally {
            setSnapshotsLoading(false);
        }
    }, [vm]);

    // 获取监控数据
    const fetchMetrics = useCallback(async () => {
        // 使用 database_id（如果存在）
        const vmId = vm?.database_id || vm?.id;
        if (!vmId) return;

        setMetricsLoading(true);
        try {
            const data = await request.get(`/monitoring/vm-history/?vm_id=${vmId}&range=${timeRange}`);
            // 确保数据是数组格式
            setMetrics(Array.isArray(data) ? data : []);
            setLastRefreshTime(moment());
        } catch (error) {
            console.error('获取监控数据失败:', error);
            message.error('获取监控数据失败');
            setMetrics([]); // 错误时设置为空数组
        } finally {
            setMetricsLoading(false);
        }
    }, [vm, timeRange]);

    // 当Tab切换时加载对应数据
    useEffect(() => {
        if (!visible || !vm) return;

        // 使用 database_id（如果存在）来调用快照/监控 API
        const hasDatabaseId = !!vm.database_id;

        if (activeTab === '2' && hasDatabaseId) {
            fetchSnapshots();
        } else if (activeTab === '3' && hasDatabaseId) {
            fetchMetrics();
        }
    }, [activeTab, visible, vm, fetchSnapshots, fetchMetrics]);

    // 自动刷新逻辑
    useEffect(() => {
        // 清理之前的定时器
        if (autoRefreshTimerRef.current) {
            clearInterval(autoRefreshTimerRef.current);
            autoRefreshTimerRef.current = null;
        }
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }

        // 只有在监控Tab、自动刷新开启、弹窗可见时才启动
        if (autoRefresh && visible && activeTab === '3') {
            setCountdown(refreshInterval);

            // 倒计时定时器（每秒更新）
            countdownTimerRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        return refreshInterval;
                    }
                    return prev - 1;
                });
            }, 1000);

            // 数据刷新定时器
            autoRefreshTimerRef.current = setInterval(() => {
                fetchMetrics();
            }, refreshInterval * 1000);
        }

        // 清理函数
        return () => {
            if (autoRefreshTimerRef.current) {
                clearInterval(autoRefreshTimerRef.current);
            }
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, [autoRefresh, refreshInterval, visible, activeTab, fetchMetrics]);

    // 弹窗关闭时停止自动刷新
    useEffect(() => {
        if (!visible) {
            setAutoRefresh(false);
        }
    }, [visible]);

    // 当监控数据变化时处理视图偏移
    useEffect(() => {
        if (metrics.length > 0) {
            const VISIBLE_POINTS_COUNT = 60;
            const maxOffset = Math.max(0, metrics.length - VISIBLE_POINTS_COUNT);

            // 初次加载或正在查看最新数据时，显示最新的时间范围
            if (prevMetricsLengthRef.current === 0 || isViewingLatest) {
                setViewOffset(maxOffset);
                setIsViewingLatest(true);
            }
            // 否则保持当前位置（用户正在查看历史数据）
            // 但如果新数据导致当前偏移超出范围，需要调整
            else if (viewOffset > maxOffset) {
                setViewOffset(maxOffset);
            }

            prevMetricsLengthRef.current = metrics.length;
        }
    }, [metrics, isViewingLatest, viewOffset]);

    // 创建快照
    const handleCreateSnapshot = async () => {
        try {
            const values = await snapshotForm.validateFields();
            const vmId = vm.database_id || vm.id;
            await request.post('/information-systems/snapshots/', {
                virtual_machine: vmId,
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
            fullTime: moment(m.timestamp).format('MM-DD HH:mm'),
            timestamp: m.timestamp,
            CPU: parseFloat(m.cpu_usage).toFixed(1),
            内存: parseFloat(m.memory_usage).toFixed(1),
            网络入: parseFloat(m.network_in).toFixed(1),
            网络出: parseFloat(m.network_out).toFixed(1)
        }));
    };

    // 计算合适的刻度间隔 - 目标显示约10个刻度标签
    const calculateTickInterval = (dataLength) => {
        // 目标：X轴大约显示10个刻度
        const targetTicks = 10;
        if (dataLength <= targetTicks) return 0; // 数据少时显示所有

        // 计算需要的间隔，使得最终显示约10个刻度
        const interval = Math.max(0, Math.floor(dataLength / targetTicks) - 1);
        return interval;
    };

    // 自定义X轴刻度格式化 - 仅显示整点或半点
    const formatXAxisTick = (tickItem, index, data) => {
        // 只显示 :00 或 :30 的时间点
        if (tickItem && (tickItem.endsWith(':00') || tickItem.endsWith(':30'))) {
            return tickItem;
        }
        return '';
    };

    // 可视数据窗口大小（显示多少个数据点）
    const VISIBLE_POINTS = 60; // 默认显示60个数据点

    // 获取当前视图内的数据
    const getVisibleData = (allData) => {
        if (!allData || allData.length === 0) return [];

        // 计算起始和结束索引
        const totalPoints = allData.length;
        const maxOffset = Math.max(0, totalPoints - VISIBLE_POINTS);
        const currentOffset = Math.min(Math.max(0, viewOffset), maxOffset);

        const startIndex = currentOffset;
        const endIndex = Math.min(currentOffset + VISIBLE_POINTS, totalPoints);

        return allData.slice(startIndex, endIndex);
    };

    // 鼠标按下开始拖拽
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragStartX(e.clientX);
        if (chartContainerRef.current) {
            chartContainerRef.current.style.cursor = 'grabbing';
        }
    };

    // 鼠标移动时拖拽
    const handleMouseMove = (e) => {
        if (!isDragging || !chartContainerRef.current) return;

        const deltaX = e.clientX - dragStartX;
        const containerWidth = chartContainerRef.current.offsetWidth;

        // 计算移动多少个数据点（每个像素对应的数据点数量）
        const pointsPerPixel = VISIBLE_POINTS / containerWidth;
        const pointsDelta = Math.round(-deltaX * pointsPerPixel * 0.5); // 0.5 是拖拽灵敏度

        // 计算新的偏移量
        const totalPoints = metrics.length;
        const maxOffset = Math.max(0, totalPoints - VISIBLE_POINTS);
        const newOffset = Math.min(Math.max(0, viewOffset + pointsDelta), maxOffset);

        if (newOffset !== viewOffset) {
            setViewOffset(newOffset);
            setDragStartX(e.clientX);

            // 更新是否正在查看最新数据的状态
            // 如果偏移量等于最大偏移量，说明在查看最新数据
            setIsViewingLatest(newOffset >= maxOffset);
        }
    };

    // 鼠标释放结束拖拽
    const handleMouseUp = () => {
        setIsDragging(false);
        if (chartContainerRef.current) {
            chartContainerRef.current.style.cursor = 'grab';
        }
    };

    // 鼠标离开图表区域
    const handleMouseLeave = () => {
        if (isDragging) {
            setIsDragging(false);
            if (chartContainerRef.current) {
                chartContainerRef.current.style.cursor = 'grab';
            }
        }
    };

    // 基本信息Tab
    const renderBasicInfo = () => {
        // 优先从 flavor 对象解析资源信息，确保准确性
        let cpuCores, memoryGb, diskGb;

        // OpenStack API 已经嵌入了完整的 flavor 对象
        if (vm?.flavor) {
            cpuCores = vm.flavor.vcpus;
            memoryGb = (vm.flavor.ram / 1024).toFixed(1);
            diskGb = vm.flavor.disk;
        }

        // Fallback: 兼容不同API返回的字段名
        if (!cpuCores) cpuCores = vm?.cpu_cores || vm?.cpu;
        if (!memoryGb) memoryGb = vm?.memory_gb || vm?.memory;
        if (!diskGb) diskGb = vm?.disk_gb || vm?.disk;

        const ipAddress = vm?.ip_address || vm?.ip || vm?.addresses ? extractIP(vm.addresses) : '未分配';

        // 处理运行时长：OpenStack 返回 launched_at时间戳
        let uptime = vm?.uptime_display || vm?.uptime || '未运行';
        if (vm?.launched_at && (vm?.status === 'ACTIVE' || vm?.status === 'running')) {
            const launchedAt = moment(vm.launched_at);
            const now = moment();
            const duration = moment.duration(now.diff(launchedAt));
            const days = Math.floor(duration.asDays());
            const hours = duration.hours();
            const minutes = duration.minutes();
            // 始终显示到分钟精度
            if (days > 0) {
                uptime = `${days}天${hours}小时${minutes}分钟`;
            } else if (hours > 0) {
                uptime = `${hours}小时${minutes}分钟`;
            } else {
                uptime = `${minutes}分钟`;
            }
        }

        return (
            <Descriptions bordered column={2}>
                <Descriptions.Item label="虚拟机名称">{vm?.name}</Descriptions.Item>
                <Descriptions.Item label="IP地址">{ipAddress}</Descriptions.Item>
                <Descriptions.Item label="CPU核数">{cpuCores ? `${cpuCores}核` : '-'}</Descriptions.Item>
                <Descriptions.Item label="内存">{memoryGb ? `${memoryGb}GB` : '-'}</Descriptions.Item>
                <Descriptions.Item label="磁盘">{diskGb ? `${diskGb}GB` : '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                    <Tag color={vm?.status === 'running' || vm?.status === 'ACTIVE' ? 'green' : 'red'}>{vm?.status_display || vm?.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="数据中心">{vm?.data_center_type_display || '-'}</Descriptions.Item>
                <Descriptions.Item label="可用区">{vm?.availability_zone || vm?.['OS-EXT-AZ:availability_zone'] || '-'}</Descriptions.Item>
                <Descriptions.Item label="操作系统">{vm?.os_type || '未知'}</Descriptions.Item>
                <Descriptions.Item label="运行时长">{uptime}</Descriptions.Item>
                <Descriptions.Item label="创建时间" span={2}>
                    {vm?.created_at || vm?.created ? moment(vm.created_at || vm.created).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
            </Descriptions>
        );
    };

    // 提取IP地址的辅助函数
    const extractIP = (addresses) => {
        if (!addresses) return '未分配';
        for (const network in addresses) {
            const ips = addresses[network];
            if (Array.isArray(ips) && ips.length > 0) {
                const ipv4 = ips.find(ip => ip.version === 4 || ip['OS-EXT-IPS:type'] === 'fixed');
                if (ipv4) return ipv4.addr || ipv4.address;
            }
        }
        return '未分配';
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
        const visibleData = getVisibleData(chartData);
        const { Text } = Typography;

        // 是否可以继续拖动（左=更早的数据，右=更新的数据）
        const maxOffset = Math.max(0, chartData.length - VISIBLE_POINTS);
        const canDragLeft = viewOffset > 0;  // 可以查看更早的数据
        const canDragRight = viewOffset < maxOffset;  // 可以查看更新的数据

        return (
            <div>
                {/* 控制栏 */}
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <Space wrap>
                        <span>时间范围：</span>
                        <Select value={timeRange} onChange={(val) => { setTimeRange(val); }} style={{ width: 120 }}>
                            <Option value="1h">最近1小时</Option>
                            <Option value="4h">最近4小时</Option>
                            <Option value="24h">最近24小时</Option>
                            <Option value="7d">最近7天</Option>
                        </Select>
                        <Button icon={<ReloadOutlined />} onClick={fetchMetrics} loading={metricsLoading}>
                            刷新
                        </Button>
                    </Space>

                    <Space wrap>
                        <span>自动刷新：</span>
                        <Switch
                            checked={autoRefresh}
                            onChange={setAutoRefresh}
                            checkedChildren={<SyncOutlined spin />}
                            unCheckedChildren="关"
                        />
                        {autoRefresh && (
                            <>
                                <Select
                                    value={refreshInterval}
                                    onChange={(val) => { setRefreshInterval(val); setCountdown(val); }}
                                    style={{ width: 90 }}
                                >
                                    <Option value={10}>10秒</Option>
                                    <Option value={30}>30秒</Option>
                                    <Option value={60}>60秒</Option>
                                </Select>
                                <Tag color="blue">
                                    <SyncOutlined spin /> {countdown}s
                                </Tag>
                            </>
                        )}
                    </Space>
                </div>

                {/* 最后刷新时间 */}
                {lastRefreshTime && (
                    <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
                        最后刷新: {lastRefreshTime.format('HH:mm:ss')}
                        {chartData.length > VISIBLE_POINTS && (
                            <span style={{ marginLeft: 16 }}>
                                📊 显示 {viewOffset + 1} - {Math.min(viewOffset + VISIBLE_POINTS, chartData.length)} / {chartData.length} 条数据
                            </span>
                        )}
                    </div>
                )}

                {metricsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
                ) : chartData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        <LineChartOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                        <p>暂无监控数据</p>
                        <p style={{ fontSize: 12 }}>监控数据每分钟采集一次，请等待片刻</p>
                    </div>
                ) : (
                    <div
                        ref={chartContainerRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        style={{
                            cursor: isDragging ? 'grabbing' : 'grab',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
                            💡 提示: 按住鼠标左键左右拖动可查看不同时间的数据
                            {canDragLeft && <span style={{ color: '#1890ff' }}> ← 查看更早</span>}
                            {canDragRight && <span style={{ color: '#52c41a' }}> → 查看更新</span>}
                            {isViewingLatest && <Tag color="green" style={{ marginLeft: 8 }}>实时</Tag>}
                            {!isViewingLatest && chartData.length > VISIBLE_POINTS && <Tag color="orange" style={{ marginLeft: 8 }}>历史</Tag>}
                        </div>
                        <h4>CPU & 内存使用率 (%)</h4>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={visibleData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="time"
                                    interval={calculateTickInterval(visibleData.length)}
                                    tick={{ fontSize: 11 }}
                                    height={35}
                                />
                                <YAxis domain={[0, 100]} />
                                <Tooltip
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]) {
                                            return payload[0].payload.fullTime || label;
                                        }
                                        return label;
                                    }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="CPU" stroke="#1890ff" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="内存" stroke="#52c41a" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>

                        <h4 style={{ marginTop: 24 }}>网络流量 (KB/s)</h4>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={visibleData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="time"
                                    interval={calculateTickInterval(visibleData.length)}
                                    tick={{ fontSize: 11 }}
                                    height={35}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(label, payload) => {
                                        if (payload && payload[0]) {
                                            return payload[0].payload.fullTime || label;
                                        }
                                        return label;
                                    }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="网络入" stroke="#faad14" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="网络出" stroke="#eb2f96" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    };

    // 检查是否有数据库 ID（用于快照和监控功能）
    const hasDatabaseId = !!vm?.database_id;

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
                {hasDatabaseId && (
                    <>
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
                    </>
                )}
            </Tabs>
        </Modal>
    );
};

export default VMDetailModal;
