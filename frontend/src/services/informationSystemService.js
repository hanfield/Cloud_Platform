/**
 * 信息系统管理服务
 */

import { request } from './api';

// 获取信息系统列表
export const getInformationSystems = async (params = {}) => {
  return request.get('/information-systems/', { params });
};

// 获取信息系统详情
export const getInformationSystem = async (id) => {
  return request.get(`/information-systems/${id}/`);
};

// 创建信息系统
export const createInformationSystem = async (data) => {
  return request.post('/information-systems/', data);
};

// 更新信息系统
export const updateInformationSystem = async (id, data) => {
  return request.put(`/information-systems/${id}/`, data);
};

// 删除信息系统
export const deleteInformationSystem = async (id) => {
  return request.delete(`/information-systems/${id}/`);
};

// 获取信息系统统计信息
export const getInformationSystemStatistics = async () => {
  return request.get('/information-systems/statistics/');
};

// 获取信息系统资源详情
export const getInformationSystemResources = async (id) => {
  return request.get(`/information-systems/${id}/resources/`);
};

// 更新信息系统状态
export const updateInformationSystemStatus = async (id, status) => {
  return request.patch(`/information-systems/${id}/status/`, { status });
};

// 获取信息系统运行时间统计
export const getInformationSystemRuntimeStats = async (id) => {
  return request.get(`/information-systems/${id}/runtime-stats/`);
};

// 获取信息系统费用信息
export const getInformationSystemBillingInfo = async (id) => {
  return request.get(`/information-systems/${id}/billing/`);
};

// 获取信息系统详细信息（包括产品、服务、虚拟机、计费记录等）
export const getInformationSystemDetailedInfo = async (id) => {
  return request.get(`/information-systems/${id}/detailed_info/`);
};

export default {
  getInformationSystems,
  getInformationSystem,
  createInformationSystem,
  updateInformationSystem,
  deleteInformationSystem,
  getInformationSystemStatistics,
  getInformationSystemResources,
  updateInformationSystemStatus,
  getInformationSystemRuntimeStats,
  getInformationSystemBillingInfo,
  getInformationSystemDetailedInfo
};