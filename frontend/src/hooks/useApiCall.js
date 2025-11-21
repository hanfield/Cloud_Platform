import { useState, useCallback } from 'react';
import { message } from 'antd';

/**
 * 通用API调用Hook
 * 统一处理API请求、响应、错误和加载状态
 * 
 * @param {string} url - API端点URL
 * @param {object} options - 配置选项
 * @returns {object} - { data, loading, error, execute, reset }
 */
const useApiCall = (url, options = {}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const {
        method = 'GET',
        showErrorMessage = true,
        showSuccessMessage = false,
        successMessage = '操作成功',
        onSuccess,
        onError,
    } = options;

    /**
     * 执行API调用
     * @param {object} requestData - 请求数据（POST/PUT时使用）
     * @param {object} customOptions - 自定义选项覆盖
     */
    const execute = useCallback(async (requestData = null, customOptions = {}) => {
        setLoading(true);
        setError(null);

        try {
            const fetchOptions = {
                method: customOptions.method || method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    ...(customOptions.headers || {})
                }
            };

            if (requestData && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                fetchOptions.body = JSON.stringify(requestData);
            }

            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.detail ||
                    errorData.message ||
                    getErrorMessage(response.status)
                );
            }

            const result = await response.json().catch(() => ({}));
            setData(result);

            if (showSuccessMessage) {
                message.success(successMessage);
            }

            if (onSuccess) {
                onSuccess(result);
            }

            return result;

        } catch (err) {
            setError(err.message);

            if (showErrorMessage) {
                message.error(err.message || '请求失败，请稍后重试');
            }

            if (onError) {
                onError(err);
            }

            throw err;

        } finally {
            setLoading(false);
        }
    }, [url, method, showErrorMessage, showSuccessMessage, successMessage, onSuccess, onError]);

    /**
     * 重置状态
     */
    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setLoading(false);
    }, []);

    return {
        data,
        loading,
        error,
        execute,
        reset
    };
};

/**
 * 根据HTTP状态码返回错误消息
 */
function getErrorMessage(status) {
    const messages = {
        400: '请求参数错误',
        401: '未登录或登录已过期，请重新登录',
        403: '没有权限执行此操作',
        404: '请求的资源不存在',
        500: '服务器错误，请稍后重试',
        502: '网关错误，请稍后重试',
        503: '服务暂时不可用，请稍后重试'
    };

    return messages[status] || `请求失败 (状态码: ${status})`;
}

export default useApiCall;
