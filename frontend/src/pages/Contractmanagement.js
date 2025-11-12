/**
 * 合同管理页面
 */

import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Select, Space, message, Table, Tag, Row, Col, Card, Statistic } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons';
import ContractForm from '../components/ContractForm';
import contractService from '../services/contractService';
import { formatDate, formatCurrency, getStatusText, getStatusColor, exportToCSV } from '../utils/helpers';

const { Search } = Input;
const { Option } = Select;

const ContractManagement = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentContract, setCurrentContract] = useState(null);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    contract_type: undefined,
    status: undefined
  });

  useEffect(() => {
    fetchContracts();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize, filters]);

  // 获取合同列表
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        search: filters.search || undefined,
        contract_type: filters.contract_type,
        status: filters.status
      };

      const response = await contractService.getContracts(params);

      setContracts(response.results || response);
      setPagination({
        ...pagination,
        total: response.count || response.length
      });
    } catch (error) {
      message.error('获取合同列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取统计信息
  const fetchStatistics = async () => {
    try {
      const statsData = await contractService.getContractStatistics();
      setStats(statsData);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contract_number',
      key: 'contract_number',
      fixed: 'left',
      width: 150,
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '合同标题',
      dataIndex: 'title',
      key: 'title',
      width: 200
    },
    {
      title: '租户',
      dataIndex: 'tenant_name',
      key: 'tenant_name',
      width: 150
    },
    {
      title: '合同类型',
      dataIndex: 'contract_type',
      key: 'contract_type',
      width: 120,
      render: (type) => {
        const typeMap = {
          'standard': '标准合同',
          'custom': '定制合同',
          'trial': '试用合同',
          'upgrade': '升级合同'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '合同总额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount) => formatCurrency(amount)
    },
    {
      title: '已付金额',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 120,
      render: (amount) => formatCurrency(amount)
    },
    {
      title: '付款进度',
      dataIndex: 'payment_progress',
      key: 'payment_progress',
      width: 120,
      render: (progress) => `${progress ? progress.toFixed(1) : 0}%`
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
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120,
      render: (date) => formatDate(date)
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120,
      render: (date) => formatDate(date)
    },
    {
      title: '剩余天数',
      dataIndex: 'days_remaining',
      key: 'days_remaining',
      width: 100,
      render: (days) => days > 0 ? `${days}天` : days === 0 ? '今天到期' : '已过期'
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
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
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const handleCreate = () => {
    setModalMode('create');
    setCurrentContract(null);
    setModalVisible(true);
  };

  const handleEdit = (contract) => {
    setModalMode('edit');
    setCurrentContract(contract);
    setModalVisible(true);
  };

  const handleView = (contract) => {
    Modal.info({
      title: '合同详情',
      width: 800,
      content: (
        <div>
          <p><strong>合同编号：</strong>{contract.contract_number}</p>
          <p><strong>合同标题：</strong>{contract.title}</p>
          <p><strong>租户：</strong>{contract.tenant_name}</p>
          <p><strong>合同类型：</strong>{contract.contract_type}</p>
          <p><strong>合同总额：</strong>{formatCurrency(contract.total_amount)}</p>
          <p><strong>已付金额：</strong>{formatCurrency(contract.paid_amount)}</p>
          <p><strong>剩余金额：</strong>{formatCurrency(contract.remaining_amount)}</p>
          <p><strong>状态：</strong>{getStatusText(contract.status)}</p>
          <p><strong>开始日期：</strong>{formatDate(contract.start_date)}</p>
          <p><strong>结束日期：</strong>{formatDate(contract.end_date)}</p>
        </div>
      ),
      onOk() {}
    });
  };

  const handleDelete = async (contract) => {
    Modal.confirm({
      title: '确定要删除该合同吗？',
      content: '删除后将无法恢复',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await contractService.deleteContract(contract.id);
          message.success('删除成功');
          fetchContracts();
          fetchStatistics();
        } catch (error) {
          message.error('删除失败: ' + error.message);
        }
      }
    });
  };

  const handleSubmit = async (values) => {
    try {
      if (modalMode === 'create') {
        await contractService.createContract(values);
        message.success('创建成功');
      } else {
        await contractService.updateContract(currentContract.id, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      fetchContracts();
      fetchStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handleRefresh = () => {
    fetchContracts();
    fetchStatistics();
  };

  const handleExport = () => {
    if (contracts.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    const exportData = contracts.map(contract => ({
      合同编号: contract.contract_number,
      合同标题: contract.title,
      租户: contract.tenant_name,
      合同类型: contract.contract_type,
      合同总额: contract.total_amount,
      已付金额: contract.paid_amount,
      状态: contract.status,
      开始日期: formatDate(contract.start_date),
      结束日期: formatDate(contract.end_date)
    }));

    exportToCSV(exportData, `contracts_${Date.now()}.csv`);
    message.success('导出成功');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <FileTextOutlined className="page-title-icon" />
          合同管理
        </h1>
        <p className="page-description">管理和查看所有合同信息</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总合同数"
              value={stats.total_count || 0}
              suffix="份"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="生效中"
              value={stats.active_count || 0}
              valueStyle={{ color: '#52c41a' }}
              suffix="份"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="合同总额"
              value={stats.total_contract_amount || 0}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已收金额"
              value={stats.total_paid_amount || 0}
              valueStyle={{ color: '#52c41a' }}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和筛选 */}
      <div className="search-bar">
        <Space wrap>
          <Search
            placeholder="搜索合同编号、标题等"
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 300 }}
            onSearch={handleSearch}
          />

          <Select
            placeholder="合同类型"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => handleFilterChange('contract_type', value)}
          >
            <Option value="standard">标准合同</Option>
            <Option value="custom">定制合同</Option>
            <Option value="trial">试用合同</Option>
            <Option value="upgrade">升级合同</Option>
          </Select>

          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            onChange={(value) => handleFilterChange('status', value)}
          >
            <Option value="draft">草稿</Option>
            <Option value="pending">待审核</Option>
            <Option value="active">生效中</Option>
            <Option value="suspended">暂停</Option>
            <Option value="terminated">已终止</Option>
            <Option value="expired">已过期</Option>
          </Select>

          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>

          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>

          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建合同
          </Button>
        </Space>
      </div>

      {/* 合同表格 */}
      <Table
        columns={columns}
        dataSource={contracts}
        loading={loading}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize });
          }
        }}
        scroll={{ x: 1800 }}
        className="custom-table"
      />

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建合同' : '编辑合同'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <ContractForm
          initialValues={currentContract}
          onSubmit={handleSubmit}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default ContractManagement;