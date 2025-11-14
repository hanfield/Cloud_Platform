/**
 * 服务管理服务
 */

import { request } from './api';

// 获取服务列表
export const getServices = async (params = {}) => {
  return request.get('/services/', { params });
};

// 获取服务详情
export const getService = async (id) => {
  return request.get(`/services/${id}/`);
};

// 创建服务
export const createService = async (data) => {
  return request.post('/services/', data);
};

// 更新服务
export const updateService = async (id, data) => {
  return request.put(`/services/${id}/`, data);
};

// 删除服务
export const deleteService = async (id) => {
  return request.delete(`/services/${id}/`);
};

// 获取服务统计信息
export const getServiceStatistics = async () => {
  return request.get('/services/statistics/');
};

// 获取服务订阅列表
export const getServiceSubscriptions = async (params = {}) => {
  return request.get('/service-subscriptions/', { params });
};

// 获取服务订阅详情
export const getServiceSubscription = async (id) => {
  return request.get(`/service-subscriptions/${id}/`);
};

// 创建服务订阅
export const createServiceSubscription = async (data) => {
  return request.post('/service-subscriptions/', data);
};

// 更新服务订阅
export const updateServiceSubscription = async (id, data) => {
  return request.put(`/service-subscriptions/${id}/`, data);
};

// 删除服务订阅
export const deleteServiceSubscription = async (id) => {
  return request.delete(`/service-subscriptions/${id}/`);
};

// 获取服务订阅统计信息
export const getServiceSubscriptionStatistics = async () => {
  return request.get('/service-subscriptions/statistics/');
};

// 获取租户服务订阅
export const getTenantServiceSubscriptions = async (tenantId) => {
  return request.get(`/tenants/${tenantId}/service-subscriptions/`);
};

// 创建租户服务订阅
export const createTenantServiceSubscription = async (tenantId, data) => {
  return request.post(`/tenants/${tenantId}/service-subscriptions/`, data);
};

// 更新租户服务订阅
export const updateTenantServiceSubscription = async (tenantId, subscriptionId, data) => {
  return request.put(`/tenants/${tenantId}/service-subscriptions/${subscriptionId}/`, data);
};

// 删除租户服务订阅
export const deleteTenantServiceSubscription = async (tenantId, subscriptionId) => {
  return request.delete(`/tenants/${tenantId}/service-subscriptions/${subscriptionId}/`);
};

export default {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  getServiceStatistics,
  getServiceSubscriptions,
  getServiceSubscription,
  createServiceSubscription,
  updateServiceSubscription,
  deleteServiceSubscription,
  getServiceSubscriptionStatistics,
  getTenantServiceSubscriptions,
  createTenantServiceSubscription,
  updateTenantServiceSubscription,
  deleteTenantServiceSubscription
};