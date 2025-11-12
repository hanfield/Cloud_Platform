/**
 * 租户管理服务
 */

import { request } from './api';

const TENANT_BASE_URL = '/tenants';

export const tenantService = {
  /**
   * 获取租户列表
   */
  getTenants: (params) => {
    return request.get(TENANT_BASE_URL + '/', { params });
  },

  /**
   * 获取租户详情
   */
  getTenantById: (id) => {
    return request.get(`${TENANT_BASE_URL}/${id}/`);
  },

  /**
   * 创建租户
   */
  createTenant: (data) => {
    return request.post(TENANT_BASE_URL + '/', data);
  },

  /**
   * 更新租户
   */
  updateTenant: (id, data) => {
    return request.put(`${TENANT_BASE_URL}/${id}/`, data);
  },

  /**
   * 部分更新租户
   */
  patchTenant: (id, data) => {
    return request.patch(`${TENANT_BASE_URL}/${id}/`, data);
  },

  /**
   * 删除租户
   */
  deleteTenant: (id) => {
    return request.delete(`${TENANT_BASE_URL}/${id}/`);
  },

  /**
   * 激活租户
   */
  activateTenant: (id) => {
    return request.post(`${TENANT_BASE_URL}/${id}/activate/`);
  },

  /**
   * 暂停租户
   */
  suspendTenant: (id) => {
    return request.post(`${TENANT_BASE_URL}/${id}/suspend/`);
  },

  /**
   * 终止租户
   */
  terminateTenant: (id) => {
    return request.post(`${TENANT_BASE_URL}/${id}/terminate/`);
  },

  /**
   * 获取租户统计信息
   */
  getTenantStatistics: () => {
    return request.get(`${TENANT_BASE_URL}/statistics/`);
  },

  /**
   * 获取租户资源使用情况
   */
  getTenantResourceUsage: (id, params) => {
    return request.get(`${TENANT_BASE_URL}/${id}/resource_usage/`, { params });
  },

  /**
   * 获取租户操作日志
   */
  getTenantOperationLogs: (id, params) => {
    return request.get(`${TENANT_BASE_URL}/${id}/operation_logs/`, { params });
  },

  /**
   * 获取资源使用记录列表
   */
  getResourceUsageList: (params) => {
    return request.get(`${TENANT_BASE_URL}/resource-usage/`, { params });
  },

  /**
   * 获取操作日志列表
   */
  getOperationLogsList: (params) => {
    return request.get(`${TENANT_BASE_URL}/operation-logs/`, { params });
  }
};

export default tenantService;