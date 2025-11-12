/**
 * OpenStack集成服务
 */

import { request } from './api';

const OPENSTACK_BASE_URL = '/openstack';

export const openstackService = {
  /**
   * 检查OpenStack连接状态
   */
  checkConnection: () => {
    return request.get(`${OPENSTACK_BASE_URL}/check-connection/`);
  },

  /**
   * 获取OpenStack资源总览
   */
  getResourcesSummary: () => {
    return request.get(`${OPENSTACK_BASE_URL}/resources/`);
  },

  /**
   * 项目管理
   */
  projects: {
    // 获取项目列表
    list: (params) => {
      return request.get(`${OPENSTACK_BASE_URL}/projects/`, { params });
    },

    // 获取项目详情
    get: (id) => {
      return request.get(`${OPENSTACK_BASE_URL}/projects/${id}/`);
    },

    // 创建项目
    create: (data) => {
      return request.post(`${OPENSTACK_BASE_URL}/projects/`, data);
    },

    // 更新项目
    update: (id, data) => {
      return request.put(`${OPENSTACK_BASE_URL}/projects/${id}/`, data);
    },

    // 删除项目
    delete: (id) => {
      return request.delete(`${OPENSTACK_BASE_URL}/projects/${id}/`);
    }
  },

  /**
   * 服务器管理
   */
  servers: {
    // 获取服务器列表
    list: (params) => {
      return request.get(`${OPENSTACK_BASE_URL}/servers/`, { params });
    },

    // 获取服务器详情
    get: (id) => {
      return request.get(`${OPENSTACK_BASE_URL}/servers/${id}/`);
    },

    // 创建服务器
    create: (data) => {
      return request.post(`${OPENSTACK_BASE_URL}/servers/`, data);
    },

    // 删除服务器
    delete: (id) => {
      return request.delete(`${OPENSTACK_BASE_URL}/servers/${id}/`);
    }
  },

  /**
   * 镜像管理
   */
  images: {
    // 获取镜像列表
    list: (params) => {
      return request.get(`${OPENSTACK_BASE_URL}/images/`, { params });
    },

    // 获取镜像详情
    get: (id) => {
      return request.get(`${OPENSTACK_BASE_URL}/images/${id}/`);
    }
  },

  /**
   * 规格管理
   */
  flavors: {
    // 获取规格列表
    list: (params) => {
      return request.get(`${OPENSTACK_BASE_URL}/flavors/`, { params });
    },

    // 获取规格详情
    get: (id) => {
      return request.get(`${OPENSTACK_BASE_URL}/flavors/${id}/`);
    }
  },

  /**
   * 网络管理
   */
  networks: {
    // 获取网络列表
    list: (params) => {
      return request.get(`${OPENSTACK_BASE_URL}/networks/`, { params });
    },

    // 创建网络
    create: (data) => {
      return request.post(`${OPENSTACK_BASE_URL}/networks/`, data);
    }
  },

  /**
   * 租户相关操作
   */
  tenants: {
    // 同步租户到OpenStack
    sync: (tenantId) => {
      return request.post(`${OPENSTACK_BASE_URL}/tenants/${tenantId}/sync/`);
    },

    // 获取租户资源使用情况
    getUsage: (tenantId) => {
      return request.get(`${OPENSTACK_BASE_URL}/tenants/${tenantId}/usage/`);
    },

    // 为租户创建资源
    createResources: (tenantId, data) => {
      return request.post(`${OPENSTACK_BASE_URL}/tenants/${tenantId}/create-resources/`, data);
    }
  }
};

export default openstackService;