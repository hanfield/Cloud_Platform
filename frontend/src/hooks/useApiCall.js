import { useState, useCallback } from 'react';
import { message } from 'antd';
import api from '../services/api';

/**
 * 通用API调用Hook - 增强版
 * 支持动态URL、query参数、所有HTTP方法
 * 底层使用 api (axios) 服务
 * 
 * @param {string} initialUrl - 初始URL（可选）
 * @param {object} globalOptions - 全局配置选项
 * @returns {object} - { data, loading, error, execute, reset }
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
            url = urlOrOptions;
            config = options;
        } else if (typeof urlOrOptions === 'object' && urlOrOptions !== null) {
            url = initialUrl;
            config = urlOrOptions;
        } else {
            url = initialUrl;
            config = {};
        }

        // 合并配置
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

            // api实例已配置baseURL为'/api'
            // 如果url已经以/api开头，需要去掉，避免重复
            const cleanUrl = fullUrl.replace(/^\/api/, '');

            // 构建axios配置
            const axiosConfig = {
                url: cleanUrl,
                method: method.toUpperCase(),
                params: params, // axios会自动处理query参数
                data: requestData,
                headers: customHeaders
                // Authorization is handled by api interceptor
            };

            // 发送请求 - api返回data直接
            const result = await api(axiosConfig);
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
            // api service throws error with response
            const errorMessage = err.response?.data?.detail ||
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                '请求失败，请稍后重试';

            setError(errorMessage);

            // 错误提示
            if (showErrorMessage) {
                message.error(errorMessage);
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

export default useApiCall;
