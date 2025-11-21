import React, { useState, useEffect } from 'react';
import { Layout, Card, Table, Tag, Button, DatePicker, Space, Statistic, Row, Col, message, Modal } from 'antd';
import { DownloadOutlined, PayCircleOutlined, FileTextOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { exportToCSV } from '../utils/helpers';
import dayjs from 'dayjs';

const { Content } = Layout;
const { RangePicker } = DatePicker;

const BillingManagement = ({ tenantId }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [currentMonthAmount, setCurrentMonthAmount] = useState(0);
    const [queryParams, setQueryParams] = useState({
        year: dayjs().year(),
    });

    useEffect(() => {
        fetchData();
    }, [queryParams, tenantId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let url = '/api/billing/monthly-bills/';
            if (tenantId) {
                url += `?tenant=${tenantId}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('获取账单数据失败');
            }

            const result = await response.json();
            const bills = result.results || result;

            setData(bills);

            // 计算当月应收（截至昨日）
            const currentMonth = dayjs().month() + 1;
            const currentYear = dayjs().year();
            const currentMonthBill = bills.find(b =>
                b.billing_year === currentYear && b.billing_month === currentMonth
            );
            setCurrentMonthAmount(currentMonthBill ? currentMonthBill.total_amount : 0);

        } catch (error) {
            message.error('获取账单数据失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 导出账单
    const handleExport = () => {
        if (data.length === 0) {
            message.warning('没有数据可导出');
            return;
        }

        const exportData = data.map(item => ({
            账单编号: item.bill_number,
            账期: `${item.billing_year}年${item.billing_month}月`,
            总金额: item.total_amount.toFixed(2),
            已付金额: item.paid_amount.toFixed(2),
            状态: item.status === 'paid' ? '已支付' : item.status === 'pending' ? '待支付' : item.status === 'overdue' ? '已逾期' : '部分支付',
            到期日: item.due_date
        }));

        exportToCSV(exportData, `bills_${dayjs().format('YYYYMMDDHHmmss')}.csv`);
        message.success('导出成功');
    };

    // 支付账单
    const handlePay = (record) => {
        Modal.confirm({
            title: '确认支付',
            icon: <ExclamationCircleOutlined />,
            content: `确定要支付账单 ${record.bill_number} 吗？金额: ¥${record.total_amount.toFixed(2)}`,
            onOk: async () => {
                try {
                    // Call API to pay
                    await fetch(`/api/billing/monthly-bills/${record.id}/pay/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                        }
                    });

                    message.success('支付成功');

                    // Update local state to reflect change immediately
                    const newData = data.map(item => {
                        if (item.id === record.id) {
                            return { ...item, status: 'paid', paid_amount: item.total_amount };
                        }
                        return item;
                    });
                    setData(newData);

                    // Refresh data from server
                    fetchData();
                } catch (error) {
                    message.error('支付失败: ' + error.message);
                }
            }
        });
    };

    const columns = [
        {
            title: '账单编号',
            dataIndex: 'bill_number',
            key: 'bill_number',
            render: (text) => <a>{text}</a>,
        },
        {
            title: '账期',
            key: 'period',
            render: (_, record) => `${record.billing_year}年${record.billing_month}月`,
        },
        {
            title: '总金额',
            dataIndex: 'total_amount',
            key: 'total_amount',
            render: (amount) => `¥${amount.toFixed(2)}`,
        },
        {
            title: '已付金额',
            dataIndex: 'paid_amount',
            key: 'paid_amount',
            render: (amount) => `¥${amount.toFixed(2)}`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default';
                let text = '未知';
                switch (status) {
                    case 'paid': color = 'success'; text = '已支付'; break;
                    case 'pending': color = 'warning'; text = '待支付'; break;
                    case 'overdue': color = 'error'; text = '已逾期'; break;
                    case 'partial_paid': color = 'processing'; text = '部分支付'; break;
                    default: break;
                }
                return <Tag color={color}>{text}</Tag>;
            },
        },
        {
            title: '到期日',
            dataIndex: 'due_date',
            key: 'due_date',
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="link" icon={<FileTextOutlined />}>详情</Button>
                    {record.status !== 'paid' && !localStorage.getItem('user_role')?.includes('admin') && (
                        <Button type="link" icon={<PayCircleOutlined />} onClick={() => handlePay(record)}>支付</Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Layout style={{ padding: '24px' }}>
            <Content>
                <div style={{ marginBottom: 24 }}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="当月应收费用 (截至昨日)"
                                    value={currentMonthAmount}
                                    precision={2}
                                    prefix="¥"
                                    valueStyle={{ color: '#1668dc' }}
                                />
                                <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                                    统计周期: {dayjs().startOf('month').format('MM-DD')} 至 {dayjs().subtract(1, 'day').format('MM-DD')}
                                </div>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="上月账单金额"
                                    value={1380.50}
                                    precision={2}
                                    prefix="¥"
                                />
                                <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                                    状态: <Tag color="warning">待支付</Tag>
                                </div>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="累计消费"
                                    value={12580.00}
                                    precision={2}
                                    prefix="¥"
                                />
                            </Card>
                        </Col>
                    </Row>
                </div>

                <Card
                    title="月度账单"
                    extra={
                        <Space>
                            <DatePicker picker="year" onChange={(date) => setQueryParams({ ...queryParams, year: date ? date.year() : null })} />
                            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出账单</Button>
                        </Space>
                    }
                >
                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                    />
                </Card>
            </Content>
        </Layout>
    );
};

export default BillingManagement;
