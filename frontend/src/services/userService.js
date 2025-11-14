import api from './api';

const userService = {
  // 获取用户列表
  getUsers: (params) => api.get('/tenants/users/', { params }),

  // 获取用户详情
  getUserById: (id) => api.get(`/tenants/users/${id}/`),

  // 创建用户
  createUser: (data) => api.post('/tenants/users/', data),

  // 更新用户
  updateUser: (id, data) => api.put(`/tenants/users/${id}/`, data),

  // 删除用户
  deleteUser: (id) => api.delete(`/tenants/users/${id}/`),

  // 审核通过用户
  approveUser: (id) => api.post(`/tenants/users/${id}/approve/`),

  // 拒绝用户
  rejectUser: (id) => api.post(`/tenants/users/${id}/reject/`),

  // 激活用户
  activateUser: (id) => api.post(`/tenants/users/${id}/activate/`),

  // 暂停用户
  suspendUser: (id) => api.post(`/tenants/users/${id}/suspend/`),

  // 重置密码
  resetPassword: (id, data) => api.post(`/tenants/users/${id}/reset_password/`, data),

  // 获取用户统计信息
  getUserStatistics: () => api.get('/tenants/users/statistics/'),

  // 获取当前用户信息
  getCurrentUser: () => api.get('/tenants/users/me/'),

  // 用户注册
  register: (data) => api.post('/auth/register/', data),
};

export default userService;