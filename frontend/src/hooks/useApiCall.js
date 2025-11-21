import { useState, useCallback } from 'react';
import { message } from 'antd';

/**
 * 通用API调用Hook - 增强版
 * 支持动态URL、query参数、所有HTTP方法
 * 
 * @param {string} initialUrl - 初始URL（可选）
 * @param {object} globalOptions - 全局配置选项
 * @returns {object} - { data, loading, error, execute, reset }
 * 
 * @example
 * // 简单GET请求
 * const { data, loading, execute } = useApiCall('/products/');
 * execute();
 * 
 * // 带参数的GET请求
 * execute({ params: { page: 1, status: 'active' } });
 * 
 * // 动态URL的POST请求
 * const { execute: createProduct } = useApiCall();
 * createProduct('/products/', { method: 'POST', data: { name: '新产品' } });
 * 
 * // 动态URL的PUT请求
 * execute(`/products/${id}/`, { method: 'PUT', data: { name: '更新' } });
 * 
 * // DELETE请求
 * execute(`/products/${id}/`, { method: 'DELETE' });
 */
const useApiCall = (initialUrl = '', globalOptions = {}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const {
        method: globalMethod = 'GET',
        showErrorMessage: globalShowError = true,
        showSuccessMessage: globalShowSuccess = false,
        successMessage: globalSuccessMsg = '操作成功',
        onSuccess: globalOnSuccess,
        onError: globalOnError,
    } = globalOptions;

    /**
     * 构建完整的URL（包含query参数）
     */
    const buildUrl = (url, params) => {
        if (!params || Object.keys(params).length === 0) {
            return url;
        }

        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                searchParams.append(key, value);
            }
        });

        const queryString = searchParams.toString();
        return queryString ? `${url}?${queryString}` : url;
    };

    /**
     * 执行API调用
     * @param {string|object} urlOrOptions - URL字符串或配置对象
     * @param {object} options - 配置选项（如果第一个参数是URL）
     */
    const execute = useCallback(async (urlOrOptions, options = {}) => {
        setLoading(true);
        setError(null);

        // 解析参数
        let url;
        let config;

        if (typeof urlOrOptions === 'string') {
            // execute('/products/', { method: 'POST', data: {...} })
            url = urlOrOptions;
            config = options;
        } else if (typeof urlOrOptions === 'object' && urlOrOptions !== null) {
            // execute({ params: { page: 1 } })
            url = initialUrl;
            config = urlOrOptions;
        } else {
            // execute()
            url = initialUrl;
            config = {};
        }

        // 合并配置（提前解构，确保在catch块中可用）
        const {
            method = globalMethod,
            params,
            data: requestData,
            headers: customHeaders = {},
            showErrorMessage = globalShowError,
            showSuccessMessage = globalShowSuccess,
            successMessage = globalSuccessMsg,
            onSuccess = globalOnSuccess,
            onError = globalOnError,
        } = config;

        try {
            // 构建完整URL
            let fullUrl = url || initialUrl;
            if (!fullUrl) {
                throw new Error('URL is required');
            }

            // 添加/api前缀
            fullUrl = fullUrl.startsWith('/api') ? fullUrl : `/api${fullUrl}`;

            // 添加query参数
            fullUrl = buildUrl(fullUrl, params);

            // 构建fetch选项
            const fetchOptions = {
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    ...customHeaders
                }
            };

            // 添加请求体（POST/PUT/PATCH）
            if (requestData && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                fetchOptions.body = JSON.stringify(requestData);
            }

            // 发送请求
            const response = await fetch(fullUrl, fetchOptions);

            // 处理响应
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.detail ||
                    errorData.message ||
                    getErrorMessage(response.status)
                );
            }

            // 解析响应数据
            const result = await response.json().catch(() => ({}));
            setData(result);

            // 成功提示
            if (showSuccessMessage) {
                message.success(successMessage);
            }

            // 成功回调
            if (onSuccess) {
                onSuccess(result);
            }

            return result;

        } catch (err) {
            setError(err.message);

            // 错误提示
            if (showErrorMessage) {
                message.error(err.message || '请求失败，请稍后重试');
            }

            // 错误回调
            if (onError) {
                onError(err);
            }

            throw err;

        } finally {
            setLoading(false);
        }
    }, [initialUrl, globalMethod, globalShowError, globalShowSuccess, globalSuccessMsg, globalOnSuccess, globalOnError]);

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
