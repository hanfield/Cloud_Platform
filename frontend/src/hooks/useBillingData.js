import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { message } from 'antd';

/**
 * 账单数据管理Hook
 * 封装账单数据获取和统计计算逻辑
 * 
 * @param {string} tenantId - 租户ID（可选，管理员查看特定租户时使用）
 * @returns {object} - { bills, statistics, loading, refresh }
 */
const useBillingData = (tenantId = null) => {
    const [bills, setBills] = useState([]);
    const [statistics, setStatistics] = useState({
        currentMonthAmount: 0,
        lastMonthBill: { amount: 0, status: 'pending' },
        totalExpense: 0
    });
    const [loading, setLoading] = useState(false);

    /**
     * 获取账单数据
     */
    const fetchBills = useCallback(async () => {
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
            const billsData = result.results || result;

            setBills(billsData);
            calculateStatistics(billsData);

        } catch (error) {
            message.error('获取账单数据失败: ' + error.message);
            setBills([]);
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    /**
     * 计算统计数据
     */
    const calculateStatistics = useCallback((billsData) => {
        const currentMonth = dayjs().month() + 1;
        const currentYear = dayjs().year();
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        // 当月应收（截至昨日）
        const currentMonthBill = billsData.find(b =>
            b.billing_year === currentYear && b.billing_month === currentMonth
        );

        // 上月账单
        const lastMonthBillData = billsData.find(b =>
            b.billing_year === lastMonthYear && b.billing_month === lastMonth
        );

        // 累计消费
        const total = billsData.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0);

        setStatistics({
            currentMonthAmount: currentMonthBill ? currentMonthBill.total_amount : 0,
            lastMonthBill: lastMonthBillData ? {
                amount: lastMonthBillData.total_amount,
                status: lastMonthBillData.status
            } : { amount: 0, status: 'pending' },
            totalExpense: total
        });
    }, []);

    /**
     * 初始加载
     */
    useEffect(() => {
        fetchBills();
    }, [fetchBills]);

    /**
     * 刷新数据
     */
    const refresh = useCallback(() => {
        fetchBills();
    }, [fetchBills]);

    return {
        bills,
        statistics,
        loading,
        refresh
    };
};

export default useBillingData;
