/**
 * 错误处理工具
 * 提供统一的错误处理和用户提示
 */

import { message } from 'antd';

/**
 * 错误消息映射
 */
const ERROR_MESSAGES = {
    // HTTP状态码错误
    400: '请求参数错误，请检查输入',
    401: '登录已过期，请重新登录',
    403: '没有权限执行此操作',
    404: '请求的资源不存在',
    409: '操作冲突，请刷新页面后重试',
    422: '数据验证失败，请检查输入',
    429: '请求过于频繁，请稍后再试',
    500: '服务器错误，请稍后重试',
    502: '网关错误，请稍后重试',
    503: '服务暂时不可用，请稍后重试',
    504: '请求超时，请检查网络连接',

    // 业务错误
    'NETWORK_ERROR': '网络连接失败，请检查网络',
    'TIMEOUT': '请求超时，请重试',
    'UNKNOWN': '未知错误'
};

/**
 * 处理API错误
 * @param {Error} error - 错误对象
 * @param {object} options - 选项
 */
export const handleApiError = (error, options = {}) => {
    const {
        showMessage = true,
        customMessage = null,
        onError = null,
        logError = true
    } = options;

    // 记录错误
    if (logError) {
        logErrorToConsole(error);
    }

    // 获取错误消息
    const errorMessage = customMessage || getErrorMessage(error);

    // 显示用户提示
    if (showMessage) {
        message.error(errorMessage);
    }

    // 执行自定义错误处理
    if (onError) {
        onError(error, errorMessage);
    }

    return errorMessage;
};

/**
 * 获取错误消息
 * @param {Error} error - 错误对象
 * @returns {string} - 错误消息
 */
export const getErrorMessage = (error) => {
    if (!error) return ERROR_MESSAGES.UNKNOWN;

    // HTTP状态码错误
    if (error.status) {
        return ERROR_MESSAGES[error.status] || `请求失败 (${error.status})`;
    }

    // 网络错误
    if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
        return ERROR_MESSAGES.NETWORK_ERROR;
    }

    // 超时错误
    if (error.message.includes('timeout')) {
        return ERROR_MESSAGES.TIMEOUT;
    }

    // 返回原始错误消息
    return error.message || ERROR_MESSAGES.UNKNOWN;
};

/**
 * 记录错误到控制台
 * @param {Error} error - 错误对象
 */
export const logErrorToConsole = (error) => {
    if (process.env.NODE_ENV === 'development') {
        console.error('[Error]', {
            message: error.message,
            status: error.status,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * 创建自定义错误
 * @param {string} message - 错误消息
 * @param {number} status - HTTP状态码
 * @returns {Error} - 错误对象
 */
export const createError = (message, status = null) => {
    const error = new Error(message);
    if (status) {
        error.status = status;
    }
    return error;
};

/**
 * 错误边界错误处理
 * @param {Error} error - 错误对象
 * @param {object} errorInfo - 错误信息
 */
export const handleComponentError = (error, errorInfo) => {
    console.error('Component Error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
    });

    // 生产环境可以发送到错误追踪服务
    if (process.env.NODE_ENV === 'production') {
        // TODO: 发送到Sentry或其他错误追踪服务
    }
};

export default {
    handleApiError,
    getErrorMessage,
    logErrorToConsole,
    createError,
    handleComponentError,
    ERROR_MESSAGES
};
