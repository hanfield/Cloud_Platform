/**
 * 产品管理服务
 */

import { request } from './api';

// 获取产品列表
export const getProducts = async (params = {}) => {
  return request.get('/products/', { params });
};

// 获取产品详情
export const getProduct = async (id) => {
  return request.get(`/products/${id}/`);
};

// 创建产品
export const createProduct = async (data) => {
  return request.post('/products/', data);
};

// 更新产品
export const updateProduct = async (id, data) => {
  return request.put(`/products/${id}/`, data);
};

// 删除产品
export const deleteProduct = async (id) => {
  return request.delete(`/products/${id}/`);
};

// 获取产品统计信息
export const getProductStatistics = async () => {
  return request.get('/products/statistics/');
};

// 获取产品定价策略
export const getProductPricing = async (id) => {
  return request.get(`/products/${id}/pricing/`);
};

// 更新产品定价策略
export const updateProductPricing = async (id, data) => {
  return request.put(`/products/${id}/pricing/`, data);
};

// 获取折扣级别列表
export const getDiscountLevels = async () => {
  return request.get('/discount-levels/');
};

// 创建折扣级别
export const createDiscountLevel = async (data) => {
  return request.post('/discount-levels/', data);
};

// 更新折扣级别
export const updateDiscountLevel = async (id, data) => {
  return request.put(`/discount-levels/${id}/`, data);
};

// 删除折扣级别
export const deleteDiscountLevel = async (id) => {
  return request.delete(`/discount-levels/${id}/`);
};

// 获取租户产品订阅
export const getTenantSubscriptions = async (tenantId) => {
  return request.get(`/tenants/${tenantId}/subscriptions/`);
};

// 创建租户产品订阅
export const createTenantSubscription = async (tenantId, data) => {
  return request.post(`/tenants/${tenantId}/subscriptions/`, data);
};

// 更新租户产品订阅
export const updateTenantSubscription = async (tenantId, subscriptionId, data) => {
  return request.put(`/tenants/${tenantId}/subscriptions/${subscriptionId}/`, data);
};

// 删除租户产品订阅
export const deleteTenantSubscription = async (tenantId, subscriptionId) => {
  return request.delete(`/tenants/${tenantId}/subscriptions/${subscriptionId}/`);
};

export default {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStatistics,
  getProductPricing,
  updateProductPricing,
  getDiscountLevels,
  createDiscountLevel,
  updateDiscountLevel,
  deleteDiscountLevel,
  getTenantSubscriptions,
  createTenantSubscription,
  updateTenantSubscription,
  deleteTenantSubscription
};