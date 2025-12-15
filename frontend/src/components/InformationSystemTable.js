/**
 * 信息系统表格组件
 */

import React from 'react';
import { Table, Button, Space, Tag, Tooltip, Popconfirm } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ToolOutlined
} from '@ant-design/icons';

const InformationSystemTable = ({
  dataSource,
  loading,
  pagination,
  onChange,
  onView,
  onEdit,
  onDelete,
  onStart,
  onStop,
  onMaintain,
  isAdmin = null // 可选，如果不传则自动检测
}) => {
  // 自动检测用户类型
  const userType = localStorage.getItem('user_type') || 'admin';
  const showDeleteButton = isAdmin !== null ? isAdmin : userType === 'admin';

  // 状态标签颜色映射
  const statusColorMap = {
    running: 'green',
    stopped: 'red',
    maintenance: 'orange'
  };

  // 状态标签文本映射
  const statusTextMap = {
    running: '运行中',
    stopped: '已停止',
    maintenance: '维护中'
  };

  // 运行模式标签映射
  const operationModeTextMap = {
    '7x24': '7x24小时',
    '5x8': '5x8小时'
  };

  const columns = [
    {
      title: '系统名称',
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
      title: '系统类型',
      dataIndex: 'system_type',
      key: 'system_type',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '运行模式',
      dataIndex: 'operation_mode',
      key: 'operation_mode',
      width: 100,
      render: (text) => (
        <Tag color={text === '7x24' ? 'blue' : 'cyan'}>
          {operationModeTextMap[text] || text}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColorMap[status]}>
          {statusTextMap[status]}
        </Tag>
      )
    },
    {
      title: '资源总量',
      key: 'resources',
      width: 200,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>CPU: {record.total_cpu || 0} 核</div>
          <div>内存: {record.total_memory || 0} GB</div>
          <div>存储: {record.total_storage || 0} GB</div>
        </div>
      )
    },
    {
      title: '所属租户',
      dataIndex: ['tenant', 'name'],
      key: 'tenant',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-'
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
      width: 240,
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

          {record.status === 'stopped' && (
            <Tooltip title="启动">
              <Button
                type="link"
                icon={<PlayCircleOutlined />}
                onClick={() => onStart(record.id)}
              />
            </Tooltip>
          )}

          {record.status === 'running' && (
            <Tooltip title="停止">
              <Button
                type="link"
                icon={<PauseCircleOutlined />}
                onClick={() => onStop(record.id)}
              />
            </Tooltip>
          )}

          {record.status !== 'maintenance' && (
            <Tooltip title="维护">
              <Button
                type="link"
                icon={<ToolOutlined />}
                onClick={() => onMaintain(record.id)}
              />
            </Tooltip>
          )}

          {showDeleteButton && (
            <Popconfirm
              title="确定删除这个信息系统吗？"
              description={<span style={{ color: '#ff4d4f' }}>⚠️ 此操作将同时删除系统下的所有虚拟机，不可恢复！</span>}
              onConfirm={() => onDelete(record.id)}
              okText="确定删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
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
        emptyText: '暂无信息系统'
      }}
    />
  );
};

export default InformationSystemTable;