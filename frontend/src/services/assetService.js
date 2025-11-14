import request from './api';

export const getPhysicalAssets = async (params = {}) => {
  return request.get('/assets/physical-assets/', { params });
};

export const getPhysicalAsset = async (id) => {
  return request.get(`/assets/physical-assets/${id}/`);
};

export const createPhysicalAsset = async (data) => {
  return request.post('/assets/physical-assets/', data);
};

export const updatePhysicalAsset = async (id, data) => {
  return request.put(`/assets/physical-assets/${id}/`, data);
};

export const deletePhysicalAsset = async (id) => {
  return request.delete(`/assets/physical-assets/${id}/`);
};

export const getPhysicalAssetStatistics = async () => {
  return request.get('/assets/physical-assets/statistics/');
};

export const getMaintenanceContracts = async (params = {}) => {
  return request.get('/assets/maintenance-contracts/', { params });
};

export const createMaintenanceContract = async (data) => {
  return request.post('/assets/maintenance-contracts/', data);
};

export const getMaintenanceRecords = async (params = {}) => {
  return request.get('/assets/maintenance-records/', { params });
};

export const createMaintenanceRecord = async (data) => {
  return request.post('/assets/maintenance-records/', data);
};

export const getIntangibleAssets = async (params = {}) => {
  return request.get('/assets/intangible-assets/', { params });
};

export const createIntangibleAsset = async (data) => {
  return request.post('/assets/intangible-assets/', data);
};

export default {
  getPhysicalAssets,
  getPhysicalAsset,
  createPhysicalAsset,
  updatePhysicalAsset,
  deletePhysicalAsset,
  getPhysicalAssetStatistics,
  getMaintenanceContracts,
  createMaintenanceContract,
  getMaintenanceRecords,
  createMaintenanceRecord,
  getIntangibleAssets,
  createIntangibleAsset
};
