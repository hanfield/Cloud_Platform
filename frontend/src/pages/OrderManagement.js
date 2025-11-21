import React, { useState, useEffect } from 'react';
import { Layout, Card, Table, Tag, Button, Input, Select, Space, message, Modal } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Option } = Select;

const OrderManagement = ({ tenantId }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    useEffect(() => {
        fetchData();
    }, [tenantId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/orders/';
            if (tenantId) {
                url += `?tenant=${tenantId}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('获取订单数据失败');
            }

            const result = await response.json();
            setData(result.results || result);

        } catch (error) {
            message.error('获取订单数据失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: '订单编号',
            dataIndex: 'order_number',
            key: 'order_number',
            render: (text) => <a>{text}</a>,
        },
        {
            title: '类型',
            dataIndex: 'order_type',
            key: 'order_type',
            render: (type) => {
                const map = {
                    'new_purchase': '新购',
                    'renewal': '续费',
                    'upgrade': '升级',
                    'downgrade': '降级'
                };
                return map[type] || type;
            }
        },
        {
            title: '金额',
            dataIndex: 'total_amount',
            key: 'total_amount',
            render: (amount) => `¥${amount.toFixed(2)}`,
        },
        {
            title: '包含项目数',
            dataIndex: 'items_count',
            key: 'items_count',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default';
                let text = status;
                switch (status) {
                    case 'completed': color = 'success'; text = '已完成'; break;
                    case 'pending_payment': color = 'warning'; text = '待支付'; break;
                    case 'cancelled': color = 'default'; text = '已取消'; break;
                    case 'processing': color = 'processing'; text = '处理中'; break;
                    default: break;
                }
                return <Tag color={color}>{text}</Tag>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="link">查看</Button>
                    {record.status === 'pending_payment' && (
                        <Button type="link">去支付</Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Layout style={{ padding: '24px' }}>
            <Content>
                <Card
                    title="订单管理"
                    extra={
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                            新建订单
                        </Button>
                    }
                >
                    <div style={{ marginBottom: 16 }}>
                        <Space>
                            <Input placeholder="搜索订单号" prefix={<SearchOutlined />} />
                            <Select placeholder="订单状态" style={{ width: 120 }}>
                                <Option value="pending_payment">待支付</Option>
                                <Option value="completed">已完成</Option>
                                <Option value="cancelled">已取消</Option>
                            </Select>
                            <Button>查询</Button>
                        </Space>
                    </div>

                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey="id"
                        loading={loading}
                    />
                </Card>

                <Modal
                    title="新建订单"
                    open={isModalVisible}
                    onOk={() => {
                        message.success('订单创建成功');
                        setIsModalVisible(false);
                    }}
                    onCancel={() => setIsModalVisible(false)}
                >
                    <p>这里是创建订单的表单（待开发）</p>
                    <p>可以选择产品、配置规格等。</p>
                </Modal>
            </Content>
        </Layout>
    );
};

export default OrderManagement;
