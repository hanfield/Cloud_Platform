import api from '../services/api';

/**
 * API客户端封装
 * 提供统一的API调用接口，底层使用 api (axios) 实例
 */
class ApiClient {
    /**
     * 发送请求
     */
    async request(url, options = {}) {
        // api实例已配置baseURL为'/api'
        // 如果url已经以/api开头，需要去掉，避免重复
        const cleanUrl = url.replace(/^\/api/, '');

        const config = {
            url: cleanUrl,
            method: options.method || 'GET',
            data: options.data,
            params: options.params,
            headers: options.headers
            // Authorization is handled by api interceptor
        };

        try {
            // api interceptor returns response.data directly
            const data = await api(config);
            return data;
        } catch (error) {
            console.error('API Request Failed:', {
                url: cleanUrl,
                method: config.method,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * GET请求
     */
    async get(url, params = {}) {
        return this.request(url, { method: 'GET', params });
    }

    /**
     * POST请求
     */
    async post(url, data = {}) {
        return this.request(url, { method: 'POST', data });
    }

    /**
     * PUT请求
     */
    async put(url, data = {}) {
        return this.request(url, { method: 'PUT', data });
    }

    /**
     * PATCH请求
     */
    async patch(url, data = {}) {
        return this.request(url, { method: 'PATCH', data });
    }

    /**
     * DELETE请求
     */
    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    }
}

// 创建默认实例
const apiClient = new ApiClient();

export default apiClient;
export { ApiClient };
