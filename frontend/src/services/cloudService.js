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

export const deleteVirtualMachine = async (id) => {
  return request.delete(`/tenants/admin/vm/${id}/delete/`);
};

export const resizeVirtualMachine = async (id, data) => {
  return request.post(`/tenants/admin/vm/${id}/resize/`, data);
};

export const getImages = async (includeSnapshots = false) => {
  const params = includeSnapshots ? { include_snapshots: 'true' } : {};
  return request.get('/openstack/images/', { params });
};

export const createImage = async (data) => {
  return request.post('/openstack/images/', data, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const updateImage = async (id, data) => {
  return request.patch(`/openstack/images/${id}/`, data);
};

export const deleteImage = async (id) => {
  return request.delete(`/openstack/images/${id}/`);
};

export const getFlavors = async () => {
  return request.get('/openstack/flavors/');
};

export const getVolumes = async (params = {}) => {
  return request.get('/openstack/volumes/', { params });
};

export const getVolumeSnapshots = async (params = {}) => {
  return request.get('/openstack/volume-snapshots/', { params });
};

// Resize相关API - OpenStack原生接口
export const resizeServer = async (id, flavorId, autoConfirm = false) => {
  return request.post(`/openstack/servers/${id}/resize/`, {
    flavor_id: flavorId,
    auto_confirm: autoConfirm
  });
};

export const confirmResize = async (id) => {
  return request.post(`/openstack/servers/${id}/confirm_resize/`);
};

export const revertResize = async (id) => {
  return request.post(`/openstack/servers/${id}/revert_resize/`);
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
  deleteVirtualMachine,
  resizeVirtualMachine,
  resizeServer,
  confirmResize,
  revertResize,
  getImages,
  createImage,
  updateImage,
  deleteImage,
  getFlavors,
  getVolumes,
  getVolumeSnapshots,
  getNetworks,
  createNetwork
};

