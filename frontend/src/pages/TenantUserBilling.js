import React, { useState, useEffect } from 'react';
import { Layout, Card, Table, Tag, Button, DatePicker, Space, Statistic, Row, Col, message, Modal, Typography } from 'antd';
import { DownloadOutlined, PayCircleOutlined, FileTextOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { exportToCSV } from '../utils/helpers';
import dayjs from 'dayjs';

const { Content } = Layout;
const { Title } = Typography;

/**
 * 租户用户账单管理组件
 * 用于租户用户门户，可以查看自己租户的账单并进行支付
 */
const TenantUserBilling = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [currentMonthAmount, setCurrentMonthAmount] = useState(0);
    const [lastMonthBill, setLastMonthBill] = useState({ amount: 0, status: 'pending' });
    const [totalExpense, setTotalExpense] = useState(0);
    const [queryParams, setQueryParams] = useState({
        year: dayjs().year(),
    });

    useEffect(() => {
        fetchData();
    }, [queryParams]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/billing/monthly-bills/', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('获取账单数据失败');
            }

            const result = await response.json();

            // 设置账单数据
            setData(result.results || result);

            // 计算统计数据
            const bills = result.results || result;
            const currentMonth = dayjs().month() + 1;
            const currentYear = dayjs().year();
            const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

            // 当月应收（截至昨日）
            const currentMonthBill = bills.find(b =>
                b.billing_year === currentYear && b.billing_month === currentMonth
            );
            setCurrentMonthAmount(currentMonthBill ? currentMonthBill.total_amount : 0);

            // 上月账单
            const lastMonthBillData = bills.find(b =>
                b.billing_year === lastMonthYear && b.billing_month === lastMonth
            );
            if (lastMonthBillData) {
                setLastMonthBill({
                    amount: lastMonthBillData.total_amount,
                    status: lastMonthBillData.status
                });
            }

            // 累计消费
            const total = bills.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0);
            setTotalExpense(total);

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
            状态: getStatusText(item.status),
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
            content: (
                <div>
                    <p>账单编号: <strong>{record.bill_number}</strong></p>
                    <p>账期: <strong>{record.billing_year}年{record.billing_month}月</strong></p>
                    <p>支付金额: <strong style={{ color: '#cf1322', fontSize: 18 }}>¥{record.total_amount.toFixed(2)}</strong></p>
                </div>
            ),
            okText: '确认支付',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await fetch(`/api/billing/monthly-bills/${record.id}/pay/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                        }
                    });

                    message.success('支付成功！');

                    // Update local state
                    const newData = data.map(item => {
                        if (item.id === record.id) {
                            return { ...item, status: 'paid', paid_amount: item.total_amount };
                        }
                        return item;
                    });
                    setData(newData);

                    // Refresh data
                    fetchData();
                } catch (error) {
                    message.error('支付失败: ' + error.message);
                }
            }
        });
    };

    // 查看账单详情
    const handleViewDetail = (record) => {
        Modal.info({
            title: '账单详情',
            width: 600,
            content: (
                <div style={{ padding: '16px 0' }}>
                    <Row gutter={[16, 16]}>
                        <Col span={12}>
                            <p><strong>账单编号:</strong> {record.bill_number}</p>
                        </Col>
                        <Col span={12}>
                            <p><strong>账期:</strong> {record.billing_year}年{record.billing_month}月</p>
                        </Col>
                        <Col span={12}>
                            <p><strong>总金额:</strong> ¥{record.total_amount.toFixed(2)}</p>
                        </Col>
                        <Col span={12}>
                            <p><strong>已付金额:</strong> ¥{record.paid_amount.toFixed(2)}</p>
                        </Col>
                        <Col span={12}>
                            <p><strong>状态:</strong> <Tag color={getStatusColor(record.status)}>{getStatusText(record.status)}</Tag></p>
                        </Col>
                        <Col span={12}>
                            <p><strong>到期日:</strong> {record.due_date}</p>
                        </Col>
                    </Row>
                </div>
            ),
        });
    };

    const getStatusText = (status) => {
        const statusMap = {
            'paid': '已支付',
            'pending': '待支付',
            'overdue': '已逾期',
            'partial_paid': '部分支付'
        };
        return statusMap[status] || '未知';
    };

    const getStatusColor = (status) => {
        const colorMap = {
            'paid': 'success',
            'pending': 'warning',
            'overdue': 'error',
            'partial_paid': 'processing'
        };
        return colorMap[status] || 'default';
    };

    const columns = [
        {
            title: '账单编号',
            dataIndex: 'bill_number',
            key: 'bill_number',
            render: (text, record) => (
                <a onClick={() => handleViewDetail(record)}>{text}</a>
            ),
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
            render: (amount) => <span style={{ fontWeight: 500 }}>¥{amount.toFixed(2)}</span>,
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
            render: (status) => (
                <Tag color={getStatusColor(status)} icon={status === 'paid' ? <CheckCircleOutlined /> : null}>
                    {getStatusText(status)}
                </Tag>
            ),
        },
        {
            title: '到期日',
            dataIndex: 'due_date',
            key: 'due_date',
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => handleViewDetail(record)}
                    >
                        详情
                    </Button>
                    {record.status !== 'paid' && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<PayCircleOutlined />}
                            onClick={() => handlePay(record)}
                        >
                            支付
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ padding: '24px' }}>
                <div style={{ marginBottom: 24 }}>
                    <Title level={3} style={{ marginBottom: 24 }}>账单管理</Title>

                    <Row gutter={16}>
                        <Col xs={24} sm={24} md={8}>
                            <Card bordered={false} style={{ height: '100%' }}>
                                <Statistic
                                    title="当月应收费用 (截至昨日)"
                                    value={currentMonthAmount}
                                    precision={2}
                                    prefix="¥"
                                    valueStyle={{ color: '#1890ff', fontSize: 28 }}
                                />
                                <div style={{ marginTop: 12, fontSize: 12, color: '#8c8c8c' }}>
                                    统计周期: {dayjs().startOf('month').format('MM-DD')} 至 {dayjs().subtract(1, 'day').format('MM-DD')}
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} sm={24} md={8}>
                            <Card bordered={false} style={{ height: '100%' }}>
                                <Statistic
                                    title="上月账单金额"
                                    value={lastMonthBill.amount}
                                    precision={2}
                                    prefix="¥"
                                    valueStyle={{
                                        color: lastMonthBill.status === 'paid' ? '#52c41a' : '#faad14',
                                        fontSize: 28
                                    }}
                                />
                                <div style={{ marginTop: 12, fontSize: 12 }}>
                                    状态: <Tag color={getStatusColor(lastMonthBill.status)}>
                                        {getStatusText(lastMonthBill.status)}
                                    </Tag>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} sm={24} md={8}>
                            <Card bordered={false} style={{ height: '100%' }}>
                                <Statistic
                                    title="累计消费"
                                    value={totalExpense}
                                    precision={2}
                                    prefix="¥"
                                    valueStyle={{ color: '#595959', fontSize: 28 }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </div>

                <Card
                    bordered={false}
                    title={<span style={{ fontSize: 16, fontWeight: 500 }}>月度账单</span>}
                    extra={
                        <Space>
                            <DatePicker
                                picker="year"
                                onChange={(date) => setQueryParams({ ...queryParams, year: date ? date.year() : null })}
                                defaultValue={dayjs()}
                            />
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleExport}
                            >
                                导出账单
                            </Button>
                        </Space>
                    }
                >
                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `共 ${total} 条记录`
                        }}
                    />
                </Card>
            </Content>
        </Layout>
    );
};

export default TenantUserBilling;
