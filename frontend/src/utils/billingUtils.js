/**
 * 账单工具函数
 * 提供账单状态、格式化等公共方法
 */

/**
 * 获取状态文本
 * @param {string} status - 状态值
 * @returns {string} - 状态文本
 */
export const getStatusText = (status) => {
    const statusMap = {
        'paid': '已支付',
        'pending': '待支付',
        'overdue': '已逾期',
        'partial_paid': '部分支付',
        'cancelled': '已取消'
    };
    return statusMap[status] || '未知';
};

/**
 * 获取状态颜色
 * @param {string} status - 状态值
 * @returns {string} - Ant Design颜色名
 */
export const getStatusColor = (status) => {
    const colorMap = {
        'paid': 'success',
        'pending': 'warning',
        'overdue': 'error',
        'partial_paid': 'processing',
        'cancelled': 'default'
    };
    return colorMap[status] || 'default';
};

/**
 * 格式化金额
 * @param {number} amount - 金额
 * @param {number} precision - 小数位数
 * @returns {string} - 格式化后的金额
 */
export const formatAmount = (amount, precision = 2) => {
    return `¥${Number(amount).toFixed(precision)}`;
};

/**
 * 格式化账期
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {string} - 格式化后的账期
 */
export const formatBillingPeriod = (year, month) => {
    return `${year}年${month}月`;
};

/**
 * 计算账单剩余金额
 * @param {object} bill - 账单对象
 * @returns {number} - 剩余金额
 */
export const calculateRemainingAmount = (bill) => {
    return (bill.total_amount || 0) - (bill.paid_amount || 0);
};

/**
 * 判断账单是否逾期
 * @param {object} bill - 账单对象
 * @returns {boolean} - 是否逾期
 */
export const isOverdue = (bill) => {
    if (bill.status === 'paid') return false;
    if (!bill.due_date) return false;

    const dueDate = new Date(bill.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
};

/**
 * 导出账单数据为CSV格式
 * @param {array} bills - 账单数组
 * @returns {array} - 导出数据
 */
export const prepareBillsForExport = (bills) => {
    return bills.map(bill => ({
        '账单编号': bill.bill_number,
        '账期': formatBillingPeriod(bill.billing_year, bill.billing_month),
        '总金额': bill.total_amount.toFixed(2),
        '已付金额': bill.paid_amount.toFixed(2),
        '未付金额': calculateRemainingAmount(bill).toFixed(2),
        '状态': getStatusText(bill.status),
        '到期日': bill.due_date || '-'
    }));
};
