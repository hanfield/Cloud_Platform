/**
 * 编辑虚拟机实例模态框
 * 支持修改名称、描述和安全组
 */

import React, { useState, useEffect } from 'react';
import {
    Modal, Form, Input, Select, Button, message, Space, Tag, Spin, Divider
} from 'antd';
import {
    EditOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { TextArea } = Input;

const VMEditModal = ({ visible, vm, onClose, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [securityGroups, setSecurityGroups] = useState([]);
    const [allSecurityGroups, setAllSecurityGroups] = useState([]);
    const [loadingSecurityGroups, setLoadingSecurityGroups] = useState(false);

    useEffect(() => {
        if (visible && vm) {
            // 初始化表单
            form.setFieldsValue({
                name: vm.name,
                description: vm.description || ''
            });

            // 获取当前安全组
            fetchServerSecurityGroups();
            // 获取所有可用安全组
            fetchAllSecurityGroups();
        }
    }, [visible, vm]);

    const fetchServerSecurityGroups = async () => {
        if (!vm?.id) return;

        setLoadingSecurityGroups(true);
        try {
            const response = await api.get(`/openstack/servers/${vm.id}/security_groups/`);
            const sgNames = (response.security_groups || []).map(sg => sg.name);
            setSecurityGroups(sgNames);
            form.setFieldsValue({ security_groups: sgNames });
        } catch (error) {
            console.error('获取安全组失败:', error);
        } finally {
            setLoadingSecurityGroups(false);
        }
    };

    const fetchAllSecurityGroups = async () => {
        try {
            const response = await api.get('/openstack/security-groups/');
            setAllSecurityGroups(Array.isArray(response) ? response : []);
        } catch (error) {
            console.error('获取安全组列表失败:', error);
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const errors = [];

            // 1. 更新名称和描述
            if (values.name !== vm.name || values.description !== (vm.description || '')) {
                try {
                    await api.put(`/openstack/servers/${vm.id}/update_info/`, {
                        name: values.name,
                        description: values.description
                    });
                } catch (e) {
                    errors.push('更新名称/描述失败: ' + (e.response?.data?.error || e.message));
                }
            }

            // 2. 更新安全组
            const newSgs = values.security_groups || [];
            const currentSgs = securityGroups;

            if (JSON.stringify(newSgs.sort()) !== JSON.stringify(currentSgs.sort())) {
                try {
                    await api.put(`/openstack/servers/${vm.id}/security-groups/`, {
                        security_groups: newSgs
                    });
                } catch (e) {
                    errors.push('更新安全组失败: ' + (e.response?.data?.error || e.message));
                }
            }

            if (errors.length > 0) {
                message.warning('部分更新失败: ' + errors.join('; '));
            } else {
                message.success('实例更新成功');
            }

            onSuccess && onSuccess();
            onClose();
        } catch (error) {
            console.error('更新失败:', error);
            message.error('更新失败: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <EditOutlined />
                    <span>编辑实例: {vm?.name}</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    取消
                </Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                    保存更改
                </Button>
            ]}
            width={600}
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                <Divider orientation="left" plain>基本信息</Divider>

                <Form.Item
                    name="name"
                    label="实例名称"
                    rules={[{ required: true, message: '请输入实例名称' }]}
                >
                    <Input placeholder="请输入实例名称" />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="描述"
                >
                    <TextArea rows={3} placeholder="请输入实例描述（可选）" />
                </Form.Item>

                <Divider orientation="left" plain>
                    <Space>
                        <SafetyCertificateOutlined />
                        安全组
                    </Space>
                </Divider>

                <Form.Item
                    name="security_groups"
                    label="关联的安全组"
                    extra="选择要关联到此实例的安全组"
                >
                    <Spin spinning={loadingSecurityGroups}>
                        <Select
                            mode="multiple"
                            placeholder="请选择安全组"
                            style={{ width: '100%' }}
                            optionFilterProp="children"
                            tagRender={(props) => {
                                const { label, closable, onClose } = props;
                                return (
                                    <Tag
                                        color="blue"
                                        closable={closable}
                                        onClose={onClose}
                                        style={{ marginRight: 3 }}
                                    >
                                        {label}
                                    </Tag>
                                );
                            }}
                        >
                            {allSecurityGroups.map(sg => (
                                <Select.Option key={sg.name || sg.id} value={sg.name}>
                                    {sg.name} {sg.description && `(${sg.description})`}
                                </Select.Option>
                            ))}
                        </Select>
                    </Spin>
                </Form.Item>

                <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                    <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                        <strong>提示：</strong>
                    </p>
                    <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                        • 修改实例名称会同时更新 OpenStack 和本地数据库
                    </p>
                    <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                        • 安全组修改会立即生效，可能影响网络访问
                    </p>
                </div>
            </Form>
        </Modal>
    );
};

export default VMEditModal;
