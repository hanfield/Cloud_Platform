/**
 * 管理员资源创建组件 - 为租户创建信息系统和虚拟机
 */

import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, Select, InputNumber, Button,
    message, Steps, Space, Divider, Card
} from 'antd';
import {
    PlusOutlined, CloudServerOutlined, DatabaseOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

const AdminResourceCreate = ({ visible, onCancel, onSuccess, type }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [tenants, setTenants] = useState([]);
    const [systems, setSystems] = useState([]);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [availabilityZones, setAvailabilityZones] = useState([]);

    useEffect(() => {
        if (visible) {
            fetchTenants();
            form.resetFields();
            setCurrentStep(0);
            if (type === 'vm') {
                fetchAvailabilityZones();
            }
        }
    }, [visible, type]);

    const fetchTenants = async () => {
        try {
            const response = await api.get('/tenants/admin/tenants/');
            if (response.success) {
                setTenants(response.tenants || []);
            }
        } catch (error) {
            console.error('获取租户列表失败:', error);
            message.error('获取租户列表失败');
        }
    };

    const fetchSystemsByTenant = async (tenantId) => {
        try {
            const response = await api.get(`/information-systems/?tenant=${tenantId}`);
            setSystems(Array.isArray(response) ? response : response.results || []);
        } catch (error) {
            console.error('获取信息系统列表失败:', error);
            message.error('获取信息系统列表失败');
        }
    };

    const fetchAvailabilityZones = async () => {
        try {
            const response = await api.get('/tenants/portal/availability-zones/');
            setAvailabilityZones(response.zones || []);
        } catch (error) {
            console.error('获取可用区列表失败:', error);
            message.warning('获取可用区列表失败,可手动输入');
        }
    };

    const handleTenantChange = (tenantId) => {
        setSelectedTenant(tenantId);
        if (type === 'vm') {
            fetchSystemsByTenant(tenantId);
            form.setFieldsValue({ system_id: undefined });
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            let response;
            if (type === 'system') {
                response = await api.post('/tenants/admin/create-system/', {
                    tenant_id: values.tenant_id,
                    name: values.name,
                    code: values.code,
                    description: values.description,
                    operation_mode: values.operation_mode || '7x24',
                    system_type: values.system_type || 'application'
                });
            } else if (type === 'vm') {
                response = await api.post('/tenants/admin/create-vm/', {
                    system_id: values.system_id,
                    name: values.name,
                    cpu_cores: values.cpu_cores,
                    memory_gb: values.memory_gb,
                    disk_gb: values.disk_gb,
                    data_center_type: values.data_center_type || 'production',
                    availability_zone: values.availability_zone || '',
                    os_type: values.os_type || 'Linux',
                    os_version: values.os_version || '',
                    description: values.description
                });
            }

            if (response && response.success) {
                message.success(`${type === 'system' ? '信息系统' : '虚拟机'}创建成功！`);
                form.resetFields();
                onSuccess && onSuccess();
                onCancel();
            } else {
                message.error(response?.error || '创建失败');
            }
        } catch (error) {
            console.error('创建失败:', error);
            message.error(error.response?.data?.error || '创建失败，请检查输入');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <Space>
                    {type === 'system' ? <DatabaseOutlined /> : <CloudServerOutlined />}
                    <span>为租户创建{type === 'system' ? '信息系统' : '虚拟机'}</span>
                </Space>
            }
            open={visible}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    取消
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={loading}
                    onClick={handleSubmit}
                    icon={<PlusOutlined />}
                >
                    创建
                </Button>
            ]}
            width={700}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    operation_mode: '7x24',
                    system_type: 'application',
                    cpu_cores: 2,
                    memory_gb: 4,
                    disk_gb: 100,
                    data_center_type: 'production',
                    os_type: 'Linux'
                }}
            >
                <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
                    <Space>
                        <span>步骤 1:</span>
                        <span><strong>选择目标租户</strong></span>
                    </Space>
                </Card>

                <Form.Item
                    name="tenant_id"
                    label="选择租户"
                    rules={[{ required: true, message: '请选择租户' }]}
                >
                    <Select
                        placeholder="请选择要创建资源的租户"
                        showSearch
                        optionFilterProp="children"
                        onChange={handleTenantChange}
                    >
                        {tenants.map(tenant => (
                            <Option key={tenant.id} value={tenant.id}>
                                {tenant.name} ({tenant.code})
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                {type === 'vm' && (
                    <Form.Item
                        name="system_id"
                        label="选择信息系统"
                        rules={[{ required: true, message: '请选择信息系统' }]}
                    >
                        <Select
                            placeholder="请选择信息系统"
                            disabled={!selectedTenant}
                            showSearch
                            optionFilterProp="children"
                        >
                            {systems.map(system => (
                                <Option key={system.id} value={system.id}>
                                    {system.name} ({system.code})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}

                <Divider />

                <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
                    <Space>
                        <span>步骤 2:</span>
                        <span><strong>配置{type === 'system' ? '信息系统' : '虚拟机'}信息</strong></span>
                    </Space>
                </Card>

                <Form.Item
                    name="name"
                    label={`${type === 'system' ? '系统' : '虚拟机'}名称`}
                    rules={[{ required: true, message: '请输入名称' }]}
                >
                    <Input placeholder={`请输入${type === 'system' ? '系统' : '虚拟机'}名称`} />
                </Form.Item>

                {type === 'system' && (
                    <>
                        <Form.Item
                            name="code"
                            label="系统编码"
                            rules={[{ required: true, message: '请输入系统编码' }]}
                        >
                            <Input placeholder="请输入系统编码（唯一）" />
                        </Form.Item>

                        <Form.Item name="system_type" label="系统类型">
                            <Select>
                                <Option value="application">应用系统</Option>
                                <Option value="database">数据库系统</Option>
                                <Option value="middleware">中间件系统</Option>
                                <Option value="monitoring">监控系统</Option>
                                <Option value="backup">备份系统</Option>
                                <Option value="other">其他系统</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="operation_mode" label="运行模式">
                            <Select>
                                <Option value="7x24">7x24小时</Option>
                                <Option value="5x8">5x8小时</Option>
                            </Select>
                        </Form.Item>
                    </>
                )}

                {type === 'vm' && (
                    <>
                        <Form.Item name="cpu_cores" label="CPU核数">
                            <InputNumber min={1} max={64} style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item name="memory_gb" label="内存大小 (GB)">
                            <InputNumber min={1} max={512} style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item name="disk_gb" label="磁盘容量 (GB)">
                            <InputNumber min={10} max={10000} style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item name="data_center_type" label="数据中心类型">
                            <Select>
                                <Option value="production">生产环境</Option>
                                <Option value="local_dr">同城灾备</Option>
                                <Option value="remote_dr">异地灾备</Option>
                                <Option value="development">开发环境</Option>
                                <Option value="testing">测试环境</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="availability_zone" label="可用区">
                            <Select placeholder="请选择可用区(可选)" allowClear>
                                {availabilityZones.map(zone => (
                                    <Option key={zone.zoneName} value={zone.zoneName}>
                                        {zone.zoneName} {zone.zoneState?.available ? '(可用)' : '(不可用)'}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="os_type" label="操作系统类型">
                            <Select>
                                <Option value="Linux">Linux</Option>
                                <Option value="Windows">Windows</Option>
                                <Option value="CentOS">CentOS</Option>
                                <Option value="Ubuntu">Ubuntu</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="os_version" label="操作系统版本">
                            <Input placeholder="例如：20.04, 7.9" />
                        </Form.Item>
                    </>
                )}

                <Form.Item name="description" label="描述">
                    <TextArea rows={3} placeholder={`请输入${type === 'system' ? '系统' : '虚拟机'}描述`} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default AdminResourceCreate;
