import request from './api';

export const getCloudOverview = async () => {
  return request.get('/openstack/cloud-overview/');
};

export const getResourceUsageReport = async () => {
  return request.get('/openstack/usage-report/');
};

export const getServers = async (params = {}) => {
  return request.get('/openstack/servers/', { params });
};

export const createServer = async (data) => {
  return request.post('/openstack/servers/', data);
};

export const deleteServer = async (id) => {
  return request.delete(`/openstack/servers/${id}/`);
};

export const getImages = async () => {
  return request.get('/openstack/images/');
};

export const getFlavors = async () => {
  return request.get('/openstack/flavors/');
};

export const getNetworks = async (params = {}) => {
  return request.get('/openstack/networks/', { params });
};

export const createNetwork = async (data) => {
  return request.post('/openstack/networks/', data);
};

export default {
  getCloudOverview,
  getResourceUsageReport,
  getServers,
  createServer,
  deleteServer,
  getImages,
  getFlavors,
  getNetworks,
  createNetwork
};
