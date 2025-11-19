import request from './api';

export const getTenantProfile = async () => {
  return request.get('/tenants/portal/profile/');
};

export const getSystemsOverview = async () => {
  return request.get('/tenants/portal/systems-overview/');
};

export const getTenantOrders = async () => {
  return request.get('/tenants/portal/orders/');
};

export const controlResource = async (data) => {
  return request.post('/tenants/portal/control-resource/', data);
};

export const getTenantSubscriptions = async () => {
  return request.get('/tenants/portal/subscriptions/');
};

export const createInformationSystem = async (data) => {
  return request.post('/tenants/portal/create-system/', data);
};

export const getAvailableProducts = async () => {
  return request.get('/tenants/portal/available-products/');
};

export const subscribeProduct = async (data) => {
  return request.post('/tenants/portal/subscribe-product/', data);
};

export const createVirtualMachine = async (data) => {
  return request.post('/tenants/portal/create-vm/', data);
};

export default {
  getTenantProfile,
  getSystemsOverview,
  getTenantOrders,
  controlResource,
  getTenantSubscriptions,
  createInformationSystem,
  getAvailableProducts,
  subscribeProduct,
  createVirtualMachine
};
