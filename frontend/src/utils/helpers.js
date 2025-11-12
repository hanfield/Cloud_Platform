/**
 * 工具函数
 */

import moment from 'moment';

/**
 * 格式化日期
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '-';
  return moment(date).format(format);
};

/**
 * 格式化日期时间
 */
export const formatDateTime = (datetime, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!datetime) return '-';
  return moment(datetime).format(format);
};

/**
 * 格式化金额
 */
export const formatCurrency = (amount, currency = '¥') => {
  if (amount === null || amount === undefined) return '-';
  return `${currency}${Number(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

/**
 * 格式化百分比
 */
export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toFixed(decimals)}%`;
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * 获取租户级别显示文本
 */
export const getTenantLevelText = (level) => {
  const levelMap = {
    'superior': '上级单位',
    'important': '重要客户',
    'ordinary': '普通客户'
  };
  return levelMap[level] || level;
};

/**
 * 获取租户级别颜色
 */
export const getTenantLevelColor = (level) => {
  const colorMap = {
    'superior': '#f5222d',
    'important': '#fa8c16',
    'ordinary': '#52c41a'
  };
  return colorMap[level] || '#d9d9d9';
};

/**
 * 获取折扣级别显示文本
 */
export const getDiscountLevelText = (level) => {
  const levelMap = {
    'level_a': 'A级(9折)',
    'level_b': 'B级(8.5折)',
    'level_c': 'C级(8折)',
    'level_d': 'D级(7.5折)',
    'level_e': 'E级(7折)',
    'level_f': 'F级(6.5折)',
    'no_discount': '无折扣'
  };
  return levelMap[level] || level;
};

/**
 * 获取租户类型显示文本
 */
export const getTenantTypeText = (type) => {
  const typeMap = {
    'virtual': '虚拟资源',
    'virtual_physical': '虚拟+物理资源',
    'virtual_physical_network': '虚拟+物理+网络线路资源',
    'datacenter_cabinet': '机房机柜资源'
  };
  return typeMap[type] || type;
};

/**
 * 获取状态显示文本
 */
export const getStatusText = (status) => {
  const statusMap = {
    'active': '活跃',
    'pending': '待审核',
    'suspended': '暂停',
    'terminated': '终止',
    'expired': '已过期',
    'draft': '草稿'
  };
  return statusMap[status] || status;
};

/**
 * 获取状态颜色
 */
export const getStatusColor = (status) => {
  const colorMap = {
    'active': 'success',
    'pending': 'warning',
    'suspended': 'error',
    'terminated': 'default',
    'expired': 'error',
    'draft': 'default'
  };
  return colorMap[status] || 'default';
};

/**
 * 获取合同类型显示文本
 */
export const getContractTypeText = (type) => {
  const typeMap = {
    'standard': '标准合同',
    'custom': '定制合同',
    'trial': '试用合同',
    'upgrade': '升级合同'
  };
  return typeMap[type] || type;
};

/**
 * 获取计费方式显示文本
 */
export const getBillingMethodText = (method) => {
  const methodMap = {
    'monthly': '按月计费',
    'quarterly': '按季度计费',
    'yearly': '按年计费',
    'pay_as_use': '按使用量计费'
  };
  return methodMap[method] || method;
};

/**
 * 获取付款方式显示文本
 */
export const getPaymentMethodText = (method) => {
  const methodMap = {
    'bank_transfer': '银行转账',
    'check': '支票',
    'cash': '现金',
    'online': '在线支付',
    'other': '其他'
  };
  return methodMap[method] || method;
};

/**
 * 计算剩余天数
 */
export const calculateDaysRemaining = (endDate) => {
  if (!endDate) return null;
  const end = moment(endDate);
  const today = moment();
  return end.diff(today, 'days');
};

/**
 * 判断是否过期
 */
export const isExpired = (endDate) => {
  if (!endDate) return false;
  return moment(endDate).isBefore(moment());
};

/**
 * 验证邮箱
 */
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * 验证手机号
 */
export const validatePhone = (phone) => {
  const re = /^1[3-9]\d{9}$/;
  return re.test(phone);
};

/**
 * 深度克隆对象
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * 防抖函数
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * 节流函数
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * 生成唯一ID
 */
export const generateId = () => {
  return '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * 导出为CSV
 */
export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      let value = row[header];
      // 处理包含逗号或换行的值
      if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 下载文件
 */
export const downloadFile = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 获取查询参数
 */
export const getQueryParams = (search = window.location.search) => {
  const params = new URLSearchParams(search);
  const result = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
};

/**
 * 设置查询参数
 */
export const setQueryParams = (params) => {
  const searchParams = new URLSearchParams(params);
  window.history.pushState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
};

/**
 * 显示成功消息
 */
export const showSuccess = (message) => {
  // 这里可以使用antd的message组件
  console.log('Success:', message);
};

/**
 * 显示错误消息
 */
export const showError = (message) => {
  // 这里可以使用antd的message组件
  console.error('Error:', message);
};

/**
 * 显示警告消息
 */
export const showWarning = (message) => {
  // 这里可以使用antd的message组件
  console.warn('Warning:', message);
};

/**
 * 本地存储操作
 */
export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error getting item from localStorage:', error);
      return null;
    }
  },

  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error setting item to localStorage:', error);
      return false;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing item from localStorage:', error);
      return false;
    }
  },

  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }
};