import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, message, Tag, Card, Row, Col, Statistic, Popconfirm
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined,
  LockOutlined, UserOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons';
import userService from '../services/userService';
import tenantService from '../services/tenantService';

const { Option } = Select;
const { Search } = Input;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({});
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    user_type: undefined,
    status: undefined
  });

  useEffect(() => {
    fetchUsers();
    fetchStatistics();
    fetchTenants();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        search: filters.search || undefined,
        user_type: filters.user_type,
        status: filters.status
      };

      const response = await userService.getUsers(params);
      setUsers(response.results || response);
      setPagination({
        ...pagination,
        total: response.count || response.length
      });
    } catch (error) {
      message.error('获取用户列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const statsData = await userService.getUserStatistics();
      setStats(statsData);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await tenantService.getTenants({ page_size: 1000 });
      setTenants(response.results || response);
    } catch (error) {
      console.error('获取租户列表失败:', error);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setCurrentUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (user) => {
    setModalMode('edit');
    setCurrentUser(user);
    form.setFieldsValue({
      email: user.email,
      user_type: user.user_type,
      tenant: user.tenant,
      status: user.status,
      phone: user.phone,
      department: user.department,
      position: user.position
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (modalMode === 'create') {
        await userService.createUser(values);
        message.success('创建成功');
      } else {
        await userService.updateUser(currentUser.id, values);
        message.success('更新成功');
      }

      setModalVisible(false);
      fetchUsers();
      fetchStatistics();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error('操作失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (id) => {
    try {
      await userService.deleteUser(id);
      message.success('删除成功');
      fetchUsers();
      fetchStatistics();
    } catch (error) {
      message.error('删除失败: ' + error.message);
    }
  };

  const handleApprove = async (id) => {
    try {
      await userService.approveUser(id);
      message.success('审核通过');
      fetchUsers();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  const handleReject = async (id) => {
    try {
      await userService.rejectUser(id);
      message.success('已拒绝');
      fetchUsers();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  const handleActivate = async (id) => {
    try {
      await userService.activateUser(id);
      message.success('已激活');
      fetchUsers();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  const handleSuspend = async (id) => {
    try {
      await userService.suspendUser(id);
      message.success('已暂停');
      fetchUsers();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  const handleResetPassword = (user) => {
    setCurrentUser(user);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      await userService.resetPassword(currentUser.id, values);
      message.success('密码重置成功');
      setPasswordModalVisible(false);
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error('操作失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'green',
      pending: 'orange',
      suspended: 'red',
      rejected: 'gray'
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      fixed: 'left',
      width: 120
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200
    },
    {
      title: '用户类型',
      dataIndex: 'user_type_display',
      key: 'user_type',
      width: 100,
      render: (text, record) => (
        <Tag color={record.user_type === 'admin' ? 'blue' : 'green'}>
          {text}
        </Tag>
      )
    },
    {
      title: '所属租户',
      dataIndex: 'tenant_name',
      key: 'tenant_name',
      width: 150,
      render: (text) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'status_display',
      key: 'status',
      width: 100,
      render: (text, record) => (
        <Tag color={getStatusColor(record.status)}>
          {text}
        </Tag>
      )
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 300,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReject(record.id)}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 'active' && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleSuspend(record.id)}
            >
              暂停
            </Button>
          )}
          {record.status === 'suspended' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleActivate(record.id)}
            >
              激活
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<LockOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <UserOutlined className="page-title-icon" />
          用户管理
        </h1>
        <p className="page-description">管理系统用户和权限</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.total_count || 0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={stats.active_count || 0}
              valueStyle={{ color: '#52c41a' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={stats.pending_count || 0}
              valueStyle={{ color: '#faad14' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已暂停"
              value={stats.suspended_count || 0}
              valueStyle={{ color: '#ff4d4f' }}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      <div className="search-bar">
        <Space wrap>
          <Search
            placeholder="搜索用户名、邮箱等"
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 300 }}
            onSearch={(value) => {
              setFilters({ ...filters, search: value });
              setPagination({ ...pagination, current: 1 });
            }}
          />

          <Select
            placeholder="用户类型"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => {
              setFilters({ ...filters, user_type: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Option value="admin">管理员</Option>
            <Option value="tenant">租户用户</Option>
          </Select>

          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            onChange={(value) => {
              setFilters({ ...filters, status: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Option value="active">已激活</Option>
            <Option value="pending">待审核</Option>
            <Option value="suspended">已暂停</Option>
            <Option value="rejected">已拒绝</Option>
          </Select>

          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
            刷新
          </Button>

          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建用户
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize });
          }
        }}
        scroll={{ x: 1500 }}
      />

      <Modal
        title={modalMode === 'create' ? '新建用户' : '编辑用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          {modalMode === 'create' && (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="用户名" />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码至少8个字符' }
                ]}
              >
                <Input.Password placeholder="密码" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="邮箱" />
          </Form.Item>

          <Form.Item
            name="user_type"
            label="用户类型"
            rules={[{ required: true, message: '请选择用户类型' }]}
          >
            <Select placeholder="选择用户类型">
              <Option value="admin">管理员</Option>
              <Option value="tenant">租户用户</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.user_type !== currentValues.user_type}
          >
            {({ getFieldValue }) =>
              getFieldValue('user_type') === 'tenant' ? (
                <Form.Item
                  name="tenant_id"
                  label="所属租户"
                  rules={[{ required: true, message: '请选择所属租户' }]}
                >
                  <Select
                    placeholder="选择租户"
                    showSearch
                    filterOption={(input, option) =>
                      option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }
                  >
                    {tenants.map(tenant => (
                      <Option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          {modalMode === 'edit' && (
            <Form.Item
              name="status"
              label="状态"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select placeholder="选择状态">
                <Option value="active">已激活</Option>
                <Option value="pending">待审核</Option>
                <Option value="suspended">已暂停</Option>
                <Option value="rejected">已拒绝</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号" />
          </Form.Item>

          <Form.Item name="department" label="部门">
            <Input placeholder="部门" />
          </Form.Item>

          <Form.Item name="position" label="职位">
            <Input placeholder="职位" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重置密码"
        open={passwordModalVisible}
        onOk={handlePasswordSubmit}
        onCancel={() => setPasswordModalVisible(false)}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
        >
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少8个字符' }
            ]}
          >
            <Input.Password placeholder="新密码" />
          </Form.Item>

          <Form.Item
            name="new_password_confirm"
            label="确认密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password placeholder="确认密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;