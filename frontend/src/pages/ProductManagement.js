/**
 * 产品管理页面
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  Input,
  Select,
  Space,
  message,
  Row,
  Col,
  Card,
  Statistic,
  Tabs,
  Tag,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  ShoppingOutlined,
  DollarOutlined,
  TeamOutlined,
  SettingOutlined
} from '@ant-design/icons';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import DiscountLevelManagement from '../components/DiscountLevelManagement';
import useApiCall from '../hooks/useApiCall';
import productService from '../services/productService';
import { exportToCSV } from '../utils/helpers';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create or edit
  const [currentProduct, setCurrentProduct] = useState(null);
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState('products');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    product_type: undefined,
    status: undefined
  });

  // 使用useApiCall获取产品列表
  const { loading, execute: fetchProducts } = useApiCall('/products/products/', {
    showErrorMessage: true,
    onSuccess: (data) => {
      setProducts(data.results || data || []);
      setPagination({
        ...pagination,
        total: data.count || data.length || 0
      });
    }
  });

  // 使用useApiCall获取统计信息
  const { execute: fetchProductStatistics } = useApiCall('/products/products/statistics/', {
    onSuccess: (data) => setStats(data)
  });

  // 创建产品
  const { execute: createProduct } = useApiCall('/products/products/', {
    method: 'POST',
    showSuccessMessage: true,
    successMessage: '创建成功',
    onSuccess: () => {
      setModalVisible(false);
      fetchProducts();
      fetchProductStatistics();
    }
  });

  // 更新产品
  const { execute: updateProduct } = useApiCall('', {
    method: 'PUT',
    showSuccessMessage: true,
    successMessage: '更新成功',
    onSuccess: () => {
      setModalVisible(false);
      fetchProducts();
      fetchProductStatistics();
    }
  });

  // 删除产品
  const { execute: deleteProduct } = useApiCall('', {
    method: 'DELETE',
    showSuccessMessage: true,
    successMessage: '删除成功',
    onSuccess: () => {
      fetchProducts();
      fetchProductStatistics();
    }
  });

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
      fetchProductStatistics();
    }
  }, [pagination.current, pagination.pageSize, filters, activeTab]);

  // 处理表格变化
  const handleTableChange = (newPagination, tableFilters, sorter) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  // 打开创建模态框
  const handleCreate = () => {
    setModalMode('create');
    setCurrentProduct(null);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (product) => {
    setModalMode('edit');
    setCurrentProduct(product);
    setModalVisible(true);
  };

  // 查看详情
  const handleView = async (product) => {
    try {
      const productDetail = await productService.getProduct(product.id);
      const pricing = await productService.getProductPricing(product.id);

      Modal.info({
        title: '产品详情',
        width: 800,
        content: (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3>基本信息</h3>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>产品名称：</strong>{productDetail.name}</p>
                  <p><strong>产品编码：</strong>{productDetail.code}</p>
                  <p><strong>产品类型：</strong>{productDetail.product_type}</p>
                </Col>
                <Col span={12}>
                  <p><strong>状态：</strong>
                    <Tag color={productDetail.status === 'active' ? 'green' : 'red'}>
                      {productDetail.status === 'active' ? '启用' : '停用'}
                    </Tag>
                  </p>
                  <p><strong>创建时间：</strong>{productDetail.created_at}</p>
                  <p><strong>更新时间：</strong>{productDetail.updated_at}</p>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3>产品描述</h3>
              <p>{productDetail.description || '暂无描述'}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h3>定价策略</h3>
              {pricing ? (
                <Row gutter={16}>
                  <Col span={6}>
                    <p><strong>基础价格：</strong>¥{pricing.base_price || 0}</p>
                  </Col>
                  <Col span={6}>
                    <p><strong>计费单位：</strong>{pricing.billing_unit || '-'}</p>
                  </Col>
                  <Col span={6}>
                    <p><strong>计费周期：</strong>{pricing.billing_period || '-'}</p>
                  </Col>
                  <Col span={6}>
                    <p><strong>定价模型：</strong>{pricing.pricing_model || '-'}</p>
                  </Col>
                </Row>
              ) : (
                <p>暂无定价信息</p>
              )}
            </div>

            <div>
              <h3>产品特性</h3>
              <p>{productDetail.features || '暂无特性描述'}</p>
            </div>
          </div>
        ),
        onOk() { }
      });
    } catch (error) {
      message.error('获取产品详情失败: ' + error.message);
    }
  };

  // 提交表单
  const handleSubmit = async (values) => {
    try {
      if (modalMode === 'create') {
        await productService.createProduct(values);
        message.success('创建成功');
      } else {
        await productService.updateProduct(currentProduct.id, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      fetchProducts();
      fetchProductStatistics();
    } catch (error) {
      message.error('操作失败: ' + error.message);
    }
  };

  // 删除产品
  const handleDelete = async (id) => {
    try {
      await productService.deleteProduct(id);
      fetchProducts();
      fetchProductStatistics();
    } catch (error) {
      throw error;
    }
  };

  // 激活产品
  const handleActivate = async (id) => {
    try {
      await productService.updateProduct(id, { status: 'active' });
      message.success('激活成功');
      fetchProducts();
    } catch (error) {
      throw error;
    }
  };

  // 停用产品
  const handleDeactivate = async (id) => {
    try {
      await productService.updateProduct(id, { status: 'inactive' });
      message.success('停用成功');
      fetchProducts();
    } catch (error) {
      throw error;
    }
  };

  // 搜索
  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  // 筛选
  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  // 刷新
  const handleRefresh = () => {
    fetchProducts();
    fetchProductStatistics();
  };

  // 导出
  const handleExport = () => {
    if (products.length === 0) {
      message.warning('没有数据可导出');
      return;
    }

    const exportData = products.map(product => ({
      产品名称: product.name,
      产品编码: product.code,
      产品类型: product.product_type,
      状态: product.status === 'active' ? '启用' : '停用',
      基础价格: product.base_price || 0,
      计费单位: product.billing_unit || '-',
      计费周期: product.billing_period || '-',
      描述: product.description || '-'
    }));

    exportToCSV(exportData, `products_${Date.now()}.csv`);
    message.success('导出成功');
  };

  // 渲染统计卡片
  const renderStatisticsCards = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="总产品数"
            value={stats.total_count || 0}
            prefix={<ShoppingOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="启用产品"
            value={stats.active_count || 0}
            valueStyle={{ color: '#52c41a' }}
            prefix={<DollarOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="订阅用户"
            value={stats.subscription_count || 0}
            prefix={<TeamOutlined />}
            suffix="个"
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="月均收入"
            value={stats.monthly_revenue || 0}
            valueStyle={{ color: '#1890ff' }}
            prefix="¥"
            precision={2}
          />
        </Card>
      </Col>
    </Row>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <ShoppingOutlined className="page-title-icon" />
          产品管理
        </h1>
        <p className="page-description">管理和配置产品、定价策略及折扣级别</p>
      </div>

      {/* 统计卡片 */}
      {renderStatisticsCards()}

      {/* 标签页 */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="产品管理" key="products">
            {/* 搜索和筛选 */}
            <div className="search-bar" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Space wrap>
                  <Search
                    placeholder="搜索产品名称、编码、描述等"
                    allowClear
                    enterButton={<SearchOutlined />}
                    style={{ width: 300 }}
                    onSearch={handleSearch}
                  />

                  <Select
                    placeholder="产品类型"
                    allowClear
                    style={{ width: 150 }}
                    onChange={(value) => handleFilterChange('product_type', value)}
                  >
                    <Option value="ecs">ECS计算资源</Option>
                    <Option value="ods">ODS存储资源</Option>
                    <Option value="net">NET网络专线</Option>
                    <Option value="anq">AnQ安全服务</Option>
                    <Option value="bas">BAS基础服务</Option>
                    <Option value="other">其他服务</Option>
                  </Select>

                  <Select
                    placeholder="状态"
                    allowClear
                    style={{ width: 120 }}
                    onChange={(value) => handleFilterChange('status', value)}
                  >
                    <Option value="active">启用</Option>
                    <Option value="inactive">停用</Option>
                  </Select>

                  <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                    刷新
                  </Button>

                  <Button icon={<ExportOutlined />} onClick={handleExport}>
                    导出
                  </Button>

                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    新建产品
                  </Button>
                </Space>
              </Space>
            </div>

            {/* 产品表格 */}
            <ProductTable
              dataSource={products}
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`
              }}
              onChange={handleTableChange}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
            />
          </TabPane>
          <TabPane tab="折扣管理" key="discounts">
            <DiscountLevelManagement />
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建产品' : '编辑产品'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ProductForm
          initialValues={currentProduct}
          onSubmit={handleSubmit}
          onCancel={() => setModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

export default ProductManagement;