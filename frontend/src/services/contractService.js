/**
 * 合同管理服务
 */

import { request } from './api';

const CONTRACT_BASE_URL = '/contracts';

export const contractService = {
  /**
   * 获取合同列表
   */
  getContracts: (params) => {
    return request.get(CONTRACT_BASE_URL + '/', { params });
  },

  /**
   * 获取合同详情
   */
  getContractById: (id) => {
    return request.get(`${CONTRACT_BASE_URL}/${id}/`);
  },

  /**
   * 创建合同
   */
  createContract: (data) => {
    return request.post(CONTRACT_BASE_URL + '/', data);
  },

  /**
   * 更新合同
   */
  updateContract: (id, data) => {
    return request.put(`${CONTRACT_BASE_URL}/${id}/`, data);
  },

  /**
   * 部分更新合同
   */
  patchContract: (id, data) => {
    return request.patch(`${CONTRACT_BASE_URL}/${id}/`, data);
  },

  /**
   * 删除合同
   */
  deleteContract: (id) => {
    return request.delete(`${CONTRACT_BASE_URL}/${id}/`);
  },

  /**
   * 审批合同
   */
  approveContract: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/${id}/approve/`);
  },

  /**
   * 拒绝合同
   */
  rejectContract: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/${id}/reject/`);
  },

  /**
   * 暂停合同
   */
  suspendContract: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/${id}/suspend/`);
  },

  /**
   * 激活合同
   */
  activateContract: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/${id}/activate/`);
  },

  /**
   * 终止合同
   */
  terminateContract: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/${id}/terminate/`);
  },

  /**
   * 获取合同统计信息
   */
  getContractStatistics: () => {
    return request.get(`${CONTRACT_BASE_URL}/statistics/`);
  },

  /**
   * 获取即将过期的合同
   */
  getExpiringContracts: (days = 30) => {
    return request.get(`${CONTRACT_BASE_URL}/expiring_soon/`, { params: { days } });
  },

  /**
   * 获取合同项目列表
   */
  getContractItems: (params) => {
    return request.get(`${CONTRACT_BASE_URL}/items/`, { params });
  },

  /**
   * 创建合同项目
   */
  createContractItem: (data) => {
    return request.post(`${CONTRACT_BASE_URL}/items/`, data);
  },

  /**
   * 更新合同项目
   */
  updateContractItem: (id, data) => {
    return request.put(`${CONTRACT_BASE_URL}/items/${id}/`, data);
  },

  /**
   * 删除合同项目
   */
  deleteContractItem: (id) => {
    return request.delete(`${CONTRACT_BASE_URL}/items/${id}/`);
  },

  /**
   * 获取付款记录列表
   */
  getPayments: (params) => {
    return request.get(`${CONTRACT_BASE_URL}/payments/`, { params });
  },

  /**
   * 创建付款记录
   */
  createPayment: (data) => {
    return request.post(`${CONTRACT_BASE_URL}/payments/`, data);
  },

  /**
   * 更新付款记录
   */
  updatePayment: (id, data) => {
    return request.put(`${CONTRACT_BASE_URL}/payments/${id}/`, data);
  },

  /**
   * 确认付款
   */
  confirmPayment: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/payments/${id}/confirm/`);
  },

  /**
   * 拒绝付款
   */
  rejectPayment: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/payments/${id}/reject_payment/`);
  },

  /**
   * 获取续约记录列表
   */
  getRenewals: (params) => {
    return request.get(`${CONTRACT_BASE_URL}/renewals/`, { params });
  },

  /**
   * 创建续约申请
   */
  createRenewal: (data) => {
    return request.post(`${CONTRACT_BASE_URL}/renewals/`, data);
  },

  /**
   * 审批续约
   */
  approveRenewal: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/renewals/${id}/approve_renewal/`);
  },

  /**
   * 拒绝续约
   */
  rejectRenewal: (id) => {
    return request.post(`${CONTRACT_BASE_URL}/renewals/${id}/reject_renewal/`);
  }
};

export default contractService;