/**
 * 产品表格组件
 */

import React from 'react';
import { Table, Button, Space, Tag, Tooltip, Popconfirm } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';

const ProductTable = ({
  dataSource,
  loading,
  pagination,
  onChange,
  onView,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate
}) => {
  // 状态标签颜色映射
  const statusColorMap = {
    active: 'green',
    inactive: 'red'
  };

  // 状态标签文本映射
  const statusTextMap = {
    active: '启用',
    inactive: '停用'
  };

  // 产品类型标签映射
  const productTypeTextMap = {
    ecs: 'ECS计算资源',
    ods: 'ODS存储资源',
    net: 'NET网络专线',
    anq: 'AnQ安全服务',
    bas: 'BAS基础服务',
    other: '其他服务'
  };

  // 产品类型颜色映射
  const productTypeColorMap = {
    ecs: 'blue',
    ods: 'cyan',
    net: 'purple',
    anq: 'red',
    bas: 'orange',
    other: 'gray'
  };

  const columns = [
    {
      title: '产品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.code}</div>
        </div>
      )
    },
    {
      title: '产品类型',
      dataIndex: 'product_type',
      key: 'product_type',
      width: 120,
      render: (type) => (
        <Tag color={productTypeColorMap[type]}>
          {productTypeTextMap[type] || type}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={statusColorMap[status]}>
          {statusTextMap[status]}
        </Tag>
      )
    },
    {
      title: '基础价格',
      dataIndex: 'base_price',
      key: 'base_price',
      width: 120,
      render: (price) => (
        <span>
          <DollarOutlined style={{ marginRight: 4 }} />
          {price || 0}
        </span>
      )
    },
    {
      title: '计费单位',
      dataIndex: 'billing_unit',
      key: 'billing_unit',
      width: 100,
      render: (unit) => unit || '-'
    },
    {
      title: '计费周期',
      dataIndex: 'billing_period',
      key: 'billing_period',
      width: 100,
      render: (period) => period || '-'
    },
    {
      title: '定价模型',
      dataIndex: 'pricing_model',
      key: 'pricing_model',
      width: 120,
      render: (model) => model || '-'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
            />
          </Tooltip>

          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>

          {record.status === 'inactive' && (
            <Tooltip title="启用">
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => onActivate(record.id)}
              />
            </Tooltip>
          )}

          {record.status === 'active' && (
            <Tooltip title="停用">
              <Button
                type="link"
                icon={<CloseCircleOutlined />}
                onClick={() => onDeactivate(record.id)}
              />
            </Tooltip>
          )}

          <Popconfirm
            title="确定删除这个产品吗？"
            description="删除后将无法恢复"
            onConfirm={() => onDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 确保dataSource始终是数组
  const safeDataSource = Array.isArray(dataSource) ? dataSource : [];

  return (
    <Table
      columns={columns}
      dataSource={safeDataSource}
      loading={loading}
      pagination={pagination}
      onChange={onChange}
      rowKey="id"
      scroll={{ x: 1200 }}
      size="middle"
      locale={{
        emptyText: '暂无产品'
      }}
    />
  );
};

export default ProductTable;