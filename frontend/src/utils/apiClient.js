/**
 * API客户端封装
 * 提供统一的API调用接口
 */

class ApiClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * 获取认证头
     */
    getAuthHeaders() {
        const token = localStorage.getItem('access_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    /**
     * 发送请求
     */
    async request(url, options = {}) {
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...this.getAuthHeaders(),
                ...(options.headers || {})
            }
        };

        const fullUrl = `${this.baseURL}${url}`;

        try {
            const response = await fetch(fullUrl, config);

            // 处理非2xx响应
            if (!response.ok) {
                const error = await this.handleError(response);
                throw error;
            }

            // 处理204 No Content
            if (response.status === 204) {
                return null;
            }

            return await response.json();

        } catch (error) {
            console.error('API Request Failed:', {
                url: fullUrl,
                method: options.method || 'GET',
                error: error.message
            });
            throw error;
        }
    }

    /**
     * 处理错误响应
     */
    async handleError(response) {
        let errorMessage = '';

        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error;
        } catch {
            errorMessage = this.getStatusMessage(response.status);
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.response = response;
        return error;
    }

    /**
     * 获取状态消息
     */
    getStatusMessage(status) {
        const messages = {
            400: '请求参数错误',
            401: '未登录或登录已过期',
            403: '没有权限执行此操作',
            404: '请求的资源不存在',
            500: '服务器错误，请稍后重试',
            502: '网关错误',
            503: '服务不可用'
        };
        return messages[status] || `请求失败 (${status})`;
    }

    /**
     * GET请求
     */
    async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        return this.request(fullUrl, { method: 'GET' });
    }

    /**
     * POST请求
     */
    async post(url, data = {}) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT请求
     */
    async put(url, data = {}) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * PATCH请求
     */
    async patch(url, data = {}) {
        return this.request(url, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
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
