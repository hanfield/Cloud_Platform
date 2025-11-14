/**
 * 服务表格组件
 */

import React from 'react';
import { Table, Tag, Button, Space, Popconfirm, Tooltip } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons';

const ServiceTable = ({
  dataSource = [],
  loading = false,
  pagination = {},
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
    inactive: 'red',
    draft: 'orange',
    suspended: 'volcano'
  };

  // 状态标签文本映射
  const statusTextMap = {
    active: '启用',
    inactive: '停用',
    draft: '草稿',
    suspended: '暂停'
  };

  // 服务类型标签颜色映射
  const serviceTypeColorMap = {
    sla: 'blue',
    support: 'green',
    monitoring: 'orange',
    backup: 'purple',
    security: 'red',
    network: 'cyan',
    other: 'default'
  };

  // 服务类型文本映射
  const serviceTypeTextMap = {
    sla: 'SLA服务',
    support: '技术支持',
    monitoring: '监控服务',
    backup: '备份服务',
    security: '安全服务',
    network: '网络服务',
    other: '其他服务'
  };

  // 可用性级别颜色映射
  const availabilityColorMap = {
    '99.999%': 'green',
    '99.99%': 'blue',
    '99.75%': 'orange',
    '99.9%': 'cyan'
  };

  const columns = [
    {
      title: '服务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text}>
          <span style={{ cursor: 'pointer' }} onClick={() => onView && onView(record)}>
            {text}
          </span>
        </Tooltip>
      )
    },
    {
      title: '服务编码',
      dataIndex: 'code',
      key: 'code',
      width: 120
    },
    {
      title: '服务类型',
      dataIndex: 'service_type',
      key: 'service_type',
      width: 120,
      render: (serviceType) => (
        <Tag color={serviceTypeColorMap[serviceType] || 'default'}>
          {serviceTypeTextMap[serviceType] || serviceType}
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
      title: '可用性',
      dataIndex: 'availability_display',
      key: 'availability',
      width: 100,
      render: (availability) => (
        <Tag color={availabilityColorMap[availability]}>
          {availability}
        </Tag>
      )
    },
    {
      title: 'MTTR',
      dataIndex: 'mttr_display',
      key: 'mttr',
      width: 100
    },
    {
      title: 'RPO',
      dataIndex: 'rpo_display',
      key: 'rpo',
      width: 80
    },
    {
      title: 'RTO',
      dataIndex: 'rto_display',
      key: 'rto',
      width: 120
    },
    {
      title: '基础价格',
      dataIndex: 'base_price',
      key: 'base_price',
      width: 100,
      render: (price) => price ? `¥${price}` : '-'
    },
    {
      title: '计费单位',
      dataIndex: 'billing_unit',
      key: 'billing_unit',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => onView && onView(record)}
            />
          </Tooltip>

          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onEdit && onEdit(record)}
            />
          </Tooltip>

          {record.status === 'active' ? (
            <Tooltip title="停用">
              <Popconfirm
                title="确定要停用此服务吗？"
                onConfirm={() => onDeactivate && onDeactivate(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  icon={<PauseCircleOutlined />}
                  danger
                />
              </Popconfirm>
            </Tooltip>
          ) : (
            <Tooltip title="启用">
              <Popconfirm
                title="确定要启用此服务吗？"
                onConfirm={() => onActivate && onActivate(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          )}

          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除此服务吗？"
              description="删除后将无法恢复"
              onConfirm={() => onDelete && onDelete(record.id)}
              okText="确定"
              cancelText="取消"
              okType="danger"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      pagination={pagination}
      onChange={onChange}
      rowKey="id"
      scroll={{ x: 1500 }}
      size="middle"
      bordered
    />
  );
};

export default ServiceTable;