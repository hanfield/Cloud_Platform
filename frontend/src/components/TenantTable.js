/**
 * 租户表格组件
 */

import React from 'react';
import { Table, Tag, Space, Button, Popconfirm, message } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import {
  formatDate,
  getTenantLevelText,
  getDiscountLevelText,
  getTenantTypeText,
  getStatusText,
  getStatusColor
} from '../utils/helpers';

const TenantTable = ({
  dataSource,
  loading,
  pagination,
  onChange,
  onView,
  onEdit,
  onDelete,
  onActivate,
  onSuspend,
  onTerminate
}) => {
  const columns = [
    {
      title: '租户名称',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 150,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '租户编码',
      dataIndex: 'code',
      key: 'code',
      width: 120
    },
    {
      title: '租户级别',
      dataIndex: 'level',
      key: 'level',
      width: 120,
      render: (level) => (
        <Tag color={
          level === 'superior' ? 'red' :
          level === 'important' ? 'orange' : 'green'
        }>
          {getTenantLevelText(level)}
        </Tag>
      )
    },
    {
      title: '折扣级别',
      dataIndex: 'discount_level',
      key: 'discount_level',
      width: 120,
      render: (level) => getDiscountLevelText(level)
    },
    {
      title: '租户类型',
      dataIndex: 'tenant_type',
      key: 'tenant_type',
      width: 180,
      render: (type) => getTenantTypeText(type)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 120
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 120,
      render: (date) => formatDate(date)
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 120,
      render: (date) => formatDate(date)
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => formatDate(date)
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>

          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              style={{ color: '#52c41a' }}
              onClick={() => handleActivate(record)}
            >
              激活
            </Button>
          )}

          {record.status === 'active' && (
            <Button
              type="link"
              size="small"
              icon={<PauseCircleOutlined />}
              style={{ color: '#faad14' }}
              onClick={() => handleSuspend(record)}
            >
              暂停
            </Button>
          )}

          {record.status === 'suspended' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              style={{ color: '#52c41a' }}
              onClick={() => handleActivate(record)}
            >
              恢复
            </Button>
          )}

          {(record.status === 'active' || record.status === 'suspended') && (
            <Button
              type="link"
              size="small"
              icon={<StopOutlined />}
              danger
              onClick={() => handleTerminate(record)}
            >
              终止
            </Button>
          )}

          <Popconfirm
            title="确定要删除该租户吗？"
            description="删除后将无法恢复"
            onConfirm={() => handleDelete(record)}
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

  const handleActivate = async (record) => {
    try {
      await onActivate(record.id);
      message.success('租户已激活');
    } catch (error) {
      message.error('激活失败: ' + error.message);
    }
  };

  const handleSuspend = async (record) => {
    try {
      await onSuspend(record.id);
      message.success('租户已暂停');
    } catch (error) {
      message.error('暂停失败: ' + error.message);
    }
  };

  const handleTerminate = async (record) => {
    try {
      await onTerminate(record.id);
      message.success('租户已终止');
    } catch (error) {
      message.error('终止失败: ' + error.message);
    }
  };

  const handleDelete = async (record) => {
    try {
      await onDelete(record.id);
      message.success('删除成功');
    } catch (error) {
      message.error('删除失败: ' + error.message);
    }
  };

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      pagination={pagination}
      onChange={onChange}
      rowKey="id"
      scroll={{ x: 2000 }}
      className="custom-table"
    />
  );
};

export default TenantTable;