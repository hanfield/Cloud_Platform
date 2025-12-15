/**
 * VM Creation Wizard - OpenStack Style
 * 5-step wizard for creating virtual machines with source selection
 */

import React, { useState, useEffect } from 'react';
import {
    Modal, Steps, Form, Input, Select, Button, Table, Space, message, Card, Row, Col, InputNumber
} from 'antd';
import {
    ArrowRightOutlined, ArrowLeftOutlined, CloudServerOutlined
} from '@ant-design/icons';
import cloudService from '../services/cloudService';
import tenantPortalService from '../services/tenantPortalService';
import api from '../services/api';
import moment from 'moment';

const { Step } = Steps;
const { Option } = Select;
const { TextArea } = Input;

const VMCreateWizard = ({ visible, onCancel, onSuccess, systems, selectedSystemId, isAdmin = false }) => {
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // 数据源
    const [images, setImages] = useState([]);
    const [instanceSnapshots, setInstanceSnapshots] = useState([]);
    const [volumes, setVolumes] = useState([]);
    const [volumeSnapshots, setVolumeSnapshots] = useState([]);
    const [flavors, setFlavors] = useState([]);
    const [networks, setNetworks] = useState([]);
    const [availabilityZones, setAvailabilityZones] = useState([]);

    // 源选择
    const [sourceType, setSourceType] = useState('image');
    const [selectedSource, setSelectedSource] = useState(null);

    // 管理员模式：租户和系统选择
    const [tenants, setTenants] = useState([]);
    const [selectedTenantId, setSelectedTenantId] = useState(null);
    const [tenantSystems, setTenantSystems] = useState([]);

    // 步骤标题
    const steps = [
        { title: '详情', description: '实例名称和系统' },
        { title: '源', description: '选择启动源' },
        { title: '实例类型', description: '选择配置' },
        { title: '网络', description: '网络配置' },
        { title: '配置', description: '高级配置' }
    ];

    useEffect(() => {
        if (visible) {
            form.resetFields();
            setCurrentStep(0);
            setSelectedSource(null);
            setSourceType('image');
            fetchAllResources();  // 加载所有资源数据

            if (selectedSystemId) {
                form.setFieldsValue({ system_id: selectedSystemId });
            }
        }
    }, [visible, selectedSystemId]);

    // 管理员模式：获取租户列表
    useEffect(() => {
        if (visible && isAdmin) {
            fetchTenants();
        }
    }, [visible, isAdmin]);

    // 当选择租户后，获取该租户的信息系统
    useEffect(() => {
        if (selectedTenantId) {
            fetchSystemsByTenant(selectedTenantId);
        }
    }, [selectedTenantId]);

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
            const systemsList = Array.isArray(response) ? response : response.results || [];
            setTenantSystems(systemsList);
        } catch (error) {
            console.error('获取信息系统列表失败:', error);
            message.error('获取信息系统列表失败');
        }
    };

    const fetchAllResources = async () => {
        try {
            // 获取普通镜像（后端自动过滤掉快照）
            const imagesRes = await cloudService.getImages(false);
            const regularImages = Array.isArray(imagesRes) ? imagesRes : [];
            setImages(regularImages);

            // 获取包含快照的完整列表，然后筛选出实例快照
            const allImagesRes = await cloudService.getImages(true);
            const allImages = Array.isArray(allImagesRes) ? allImagesRes : [];

            // 快照 = 全部镜像 - 普通镜像
            const regularImageIds = new Set(regularImages.map(img => img.id));
            const snapshots = allImages.filter(img => !regularImageIds.has(img.id));

            console.log('普通镜像:', regularImages.length, regularImages.map(i => i.name));
            console.log('实例快照:', snapshots.length, snapshots.map(i => i.name));

            setInstanceSnapshots(snapshots);

            // 获取卷 - 只显示可启动(bootable)且可用(available)的卷
            const volumesRes = await cloudService.getVolumes();
            const allVolumes = Array.isArray(volumesRes) ? volumesRes : [];
            // 过滤：bootable=true 且 status=available
            const bootableVolumes = allVolumes.filter(vol =>
                (vol.is_bootable === true || vol.bootable === true || vol.is_bootable === 'true' || vol.bootable === 'true') &&
                vol.status === 'available'
            );
            console.log('卷总数:', allVolumes.length, '可启动且可用:', bootableVolumes.length);
            setVolumes(bootableVolumes);

            // 获取卷快照 - 只显示可用的快照
            const volSnapRes = await cloudService.getVolumeSnapshots();
            const allSnapshots = Array.isArray(volSnapRes) ? volSnapRes : [];
            const availableSnapshots = allSnapshots.filter(snap => snap.status === 'available');
            console.log('卷快照总数:', allSnapshots.length, '可用:', availableSnapshots.length);
            setVolumeSnapshots(availableSnapshots);

            // 获取实例类型
            const flavorsRes = await cloudService.getFlavors();
            setFlavors(Array.isArray(flavorsRes) ? flavorsRes : []);

            // 获取网络
            const networksRes = await cloudService.getNetworks();
            setNetworks(Array.isArray(networksRes) ? networksRes : []);

            // 获取可用区
            const zonesRes = await tenantPortalService.getAvailabilityZones();
            setAvailabilityZones(zonesRes.zones || []);
        } catch (error) {
            console.error('获取资源失败:', error);
            message.warning('获取部分资源失败，可能影响创建流程');
        }
    };

    const getSourceData = () => {
        switch (sourceType) {
            case 'image':
                return images;
            case 'instance_snapshot':
                return instanceSnapshots;
            case 'volume':
                return volumes;
            case 'volume_snapshot':
                return volumeSnapshots;
            default:
                return [];
        }
    };

    // 根据源类型动态生成列配置，匹配 OpenStack Horizon 显示
    const getSourceColumns = () => {
        // Image / Instance Snapshot: Name, Updated, Size, Format, Visibility
        if (sourceType === 'image' || sourceType === 'instance_snapshot') {
            return [
                {
                    title: '名称',
                    dataIndex: 'name',
                    key: 'name',
                    sorter: (a, b) => (a.name || '').localeCompare(b.name || '')
                },
                {
                    title: '更新时间',
                    key: 'updated',
                    render: (_, record) => {
                        const time = record.updated_at || record.updated;
                        return time ? moment(time).format('MM/DD/YY HH:mm') : '-';
                    }
                },
                {
                    title: '大小',
                    key: 'size',
                    render: (_, record) => {
                        const size = record.size || 0;
                        if (size >= 1024 * 1024 * 1024) {
                            return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
                        } else if (size >= 1024 * 1024) {
                            return `${(size / 1024 / 1024).toFixed(2)} MB`;
                        }
                        return size > 0 ? `${size} bytes` : '-';
                    }
                },
                {
                    title: '格式',
                    dataIndex: 'disk_format',
                    key: 'disk_format',
                    render: (format) => (format || '-').toUpperCase()
                },
                {
                    title: '可见性',
                    dataIndex: 'visibility',
                    key: 'visibility',
                    render: (visibility) => {
                        const map = { 'public': '公有', 'private': '私有', 'shared': '共享' };
                        return map[visibility] || visibility || '-';
                    }
                },
                {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                        selectedSource?.id === record.id ?
                            <Button size="small" onClick={() => setSelectedSource(null)}>取消选择</Button> :
                            <Button type="primary" size="small" onClick={() => setSelectedSource(record)}>选 择</Button>
                    )
                }
            ];
        }

        // Volume: Name, Description, Size, Type, Availability Zone
        if (sourceType === 'volume') {
            return [
                {
                    title: '名称',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name, record) => name || <span style={{ color: '#999' }}>{record.id?.substring(0, 8)}...</span>
                },
                {
                    title: '描述',
                    dataIndex: 'description',
                    key: 'description',
                    render: (desc) => desc || '-'
                },
                {
                    title: '大小',
                    dataIndex: 'size',
                    key: 'size',
                    render: (size) => size ? `${size} GB` : '-'
                },
                {
                    title: '类型',
                    dataIndex: 'volume_type',
                    key: 'volume_type',
                    render: (type) => type || '-'
                },
                {
                    title: '可用区',
                    dataIndex: 'availability_zone',
                    key: 'availability_zone',
                    render: (az) => az || '-'
                },
                {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                        selectedSource?.id === record.id ?
                            <Button size="small" onClick={() => setSelectedSource(null)}>取消选择</Button> :
                            <Button type="primary" size="small" onClick={() => setSelectedSource(record)}>选 择</Button>
                    )
                }
            ];
        }

        // Volume Snapshot: Name, Description, Size, Created, Status
        if (sourceType === 'volume_snapshot') {
            return [
                {
                    title: '名称',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name, record) => name || <span style={{ color: '#999' }}>{record.id?.substring(0, 8)}...</span>
                },
                {
                    title: '描述',
                    dataIndex: 'description',
                    key: 'description',
                    render: (desc) => desc || '-'
                },
                {
                    title: '大小',
                    dataIndex: 'size',
                    key: 'size',
                    render: (size) => size ? `${size} GB` : '-'
                },
                {
                    title: '创建时间',
                    key: 'created',
                    render: (_, record) => {
                        const time = record.created_at || record.created;
                        return time ? moment(time).format('MM/DD/YY HH:mm') : '-';
                    }
                },
                {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => {
                        const statusMap = { 'available': '可用', 'creating': '创建中', 'error': '错误' };
                        return statusMap[status] || status || '-';
                    }
                },
                {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                        selectedSource?.id === record.id ?
                            <Button size="small" onClick={() => setSelectedSource(null)}>取消选择</Button> :
                            <Button type="primary" size="small" onClick={() => setSelectedSource(record)}>选 择</Button>
                    )
                }
            ];
        }

        return [];
    };

    const sourceColumns = getSourceColumns();

    const flavorColumns = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: 'CPU',
            dataIndex: 'vcpus',
            key: 'vcpus',
            render: (vcpus) => `${vcpus} 核`
        },
        {
            title: '内存',
            dataIndex: 'ram',
            key: 'ram',
            render: (ram) => `${(ram / 1024).toFixed(1)} GB`
        },
        {
            title: '磁盘',
            dataIndex: 'disk',
            key: 'disk',
            render: (disk) => disk === 0
                ? <span style={{ color: '#faad14' }}>0 GB (需使用卷启动)</span>
                : `${disk} GB`
        }
    ];

    const networkColumns = [
        {
            title: '网络名称',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: '子网',
            dataIndex: 'subnets',
            key: 'subnets',
            render: (subnets) => subnets && subnets.length > 0 ? subnets.map(s => s.cidr || s).join(', ') : '-'
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status'
        }
    ];

    const handleNext = async () => {
        try {
            // 验证当前步骤
            if (currentStep === 0) {
                const fieldsToValidate = isAdmin ? ['tenant_id', 'name', 'system_id'] : ['name', 'system_id'];
                await form.validateFields(fieldsToValidate);
            } else if (currentStep === 1) {
                if (!selectedSource) {
                    message.warning('请选择启动源');
                    return;
                }
            } else if (currentStep === 2) {
                await form.validateFields(['flavor_id']);
            } else if (currentStep === 3) {
                await form.validateFields(['network_id']);
            }

            if (currentStep < steps.length - 1) {
                setCurrentStep(currentStep + 1);
            }
        } catch (error) {
            console.error('验证失败:', error);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            // 构建创建数据
            const vmData = {
                name: values.name,
                system_id: values.system_id,
                description: values.description || '',
                data_center_type: values.data_center_type || 'production',
                availability_zone: values.availability_zone || '',
                flavor_id: values.flavor_id,
                network_id: values.network_id,
                source_type: sourceType,
                source_id: selectedSource?.id
            };

            // 根据源类型设置相应字段
            if (sourceType === 'image' || sourceType === 'instance_snapshot') {
                vmData.image_id = selectedSource.id;
            } else if (sourceType === 'volume') {
                vmData.volume_id = selectedSource.id;
            } else if (sourceType === 'volume_snapshot') {
                vmData.snapshot_id = selectedSource.id;
            }

            await tenantPortalService.createVirtualMachine(vmData);
            message.success('虚拟机创建成功');
            form.resetFields();
            onSuccess && onSuccess();
            onCancel();
        } catch (error) {
            console.error('创建虚拟机失败:', error);
            message.error('创建虚拟机失败: ' + (error.message || '未知错误'));
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                // 步骤1: 详情
                return (
                    <div style={{ padding: '20px 0' }}>
                        {isAdmin && (
                            <Form.Item
                                name="tenant_id"
                                label="选择租户"
                                rules={[{ required: true, message: '请选择租户' }]}
                            >
                                <Select
                                    placeholder="请选择租户"
                                    onChange={(value) => {
                                        setSelectedTenantId(value);
                                        form.setFieldsValue({ system_id: undefined }); // 清空系统选择
                                    }}
                                >
                                    {tenants.map(tenant => (
                                        <Option key={tenant.id} value={tenant.id}>{tenant.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        )}

                        <Form.Item
                            name="name"
                            label="实例名称"
                            rules={[{ required: true, message: '请输入实例名称' }]}
                        >
                            <Input placeholder="例如: web-server-01" />
                        </Form.Item>

                        <Form.Item
                            name="system_id"
                            label="所属信息系统"
                            initialValue={selectedSystemId}
                            rules={[{ required: true, message: '请选择所属信息系统' }]}
                        >
                            <Select placeholder="请选择信息系统" disabled={!!selectedSystemId || (isAdmin && !selectedTenantId)}>
                                {(isAdmin ? tenantSystems : systems).map(sys => (
                                    <Option key={sys.id} value={sys.id}>{sys.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="description" label="描述">
                            <TextArea rows={3} placeholder="虚拟机用途描述" />
                        </Form.Item>
                    </div>
                );

            case 1:
                // 步骤2: 源
                return (
                    <div style={{ padding: '20px 0' }}>
                        <Card size="small" style={{ marginBottom: 16 }}>
                            <Row gutter={16} align="middle">
                                <Col span={6}>
                                    <strong>选择源类型：</strong>
                                </Col>
                                <Col span={18}>
                                    <Select
                                        value={sourceType}
                                        onChange={(value) => {
                                            setSourceType(value);
                                            setSelectedSource(null);
                                        }}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="image">镜像 (Image)</Option>
                                        <Option value="instance_snapshot">实例快照 (Instance Snapshot)</Option>
                                        <Option value="volume">卷 (Volume)</Option>
                                        <Option value="volume_snapshot">卷快照 (Volume Snapshot)</Option>
                                    </Select>
                                </Col>
                            </Row>
                        </Card>

                        {selectedSource && (
                            <Card size="small" style={{ marginBottom: 16, background: '#e6f7ff' }}>
                                <div><strong>已选择:</strong> {selectedSource.name || selectedSource.id?.substring(0, 8) + '...' || '-'}</div>
                            </Card>
                        )}

                        <Card title="可用资源" size="small">
                            <Table
                                dataSource={getSourceData()}
                                columns={sourceColumns}
                                rowKey="id"
                                size="small"
                                pagination={{ pageSize: 5 }}
                            />
                        </Card>
                    </div>
                );

            case 2:
                // 步骤3: 实例类型
                return (
                    <div style={{ padding: '20px 0' }}>
                        <Form.Item
                            name="flavor_id"
                            label="实例类型"
                            rules={[{ required: true, message: '请选择实例类型' }]}
                        >
                            <Select
                                placeholder="请选择实例类型"
                                showSearch
                                optionFilterProp="children"
                            >
                                {flavors.map(flavor => (
                                    <Option key={flavor.id} value={flavor.id}>
                                        {flavor.name} ({flavor.vcpus}核 / {(flavor.ram / 1024).toFixed(1)}GB / {flavor.disk}GB)
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Table
                            dataSource={flavors}
                            columns={flavorColumns}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 5 }}
                        />
                    </div>
                );

            case 3:
                // 步骤4: 网络
                return (
                    <div style={{ padding: '20px 0' }}>
                        <Form.Item
                            name="network_id"
                            label="网络"
                            rules={[{ required: true, message: '请选择网络' }]}
                        >
                            <Select
                                placeholder="请选择网络"
                                showSearch
                                optionFilterProp="children"
                            >
                                {networks.map(network => (
                                    <Option key={network.id} value={network.id}>
                                        {network.name} ({network.status})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Table
                            dataSource={networks}
                            columns={networkColumns}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 5 }}
                        />
                    </div>
                );

            case 4:
                // 步骤5: 配置
                return (
                    <div style={{ padding: '20px 0' }}>
                        <Form.Item name="data_center_type" label="数据中心类型" initialValue="production">
                            <Select>
                                <Option value="production">生产环境</Option>
                                <Option value="local_dr">同城灾备</Option>
                                <Option value="remote_dr">异地灾备</Option>
                                <Option value="development">开发环境</Option>
                                <Option value="testing">测试环境</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="availability_zone" label="可用区">
                            <Select placeholder="请选择可用区（可选）" allowClear>
                                {availabilityZones.map(zone => (
                                    <Option key={zone.name} value={zone.name}>{zone.name}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Card title="配置摘要" size="small" style={{ marginTop: 20 }}>
                            <p><strong>实例名称:</strong> {form.getFieldValue('name') || '-'}</p>
                            <p><strong>启动源:</strong> {selectedSource?.name || '-'} ({sourceType})</p>
                            <p><strong>实例类型:</strong> {flavors.find(f => f.id === form.getFieldValue('flavor_id'))?.name || '-'}</p>
                            <p><strong>网络:</strong> {networks.find(n => n.id === form.getFieldValue('network_id'))?.name || '-'}</p>
                        </Card>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <CloudServerOutlined />
                    <span>创建虚拟机实例</span>
                </Space>
            }
            open={visible}
            onCancel={onCancel}
            width={900}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    取消
                </Button>,
                currentStep > 0 && (
                    <Button key="previous" onClick={handlePrevious}>
                        <ArrowLeftOutlined /> 上一步
                    </Button>
                ),
                currentStep < steps.length - 1 && (
                    <Button key="next" type="primary" onClick={handleNext}>
                        下一步 <ArrowRightOutlined />
                    </Button>
                ),
                currentStep === steps.length - 1 && (
                    <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                        创建实例
                    </Button>
                )
            ]}
            destroyOnClose
        >
            <Steps current={currentStep} style={{ marginBottom: 24 }}>
                {steps.map((step, index) => (
                    <Step key={index} title={step.title} description={step.description} />
                ))}
            </Steps>

            <Form form={form} layout="vertical">
                {renderStepContent()}
            </Form>
        </Modal>
    );
};

export default VMCreateWizard;
