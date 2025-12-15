import api from '../services/api';
import AdminResourceCreate from '../components/AdminResourceCreate';
import VMCreateWizard from '../components/VMCreateWizard';
import VMDetailModal from '../components/VMDetailModal';
import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Card, Row, Col, Statistic, Tabs, Table, Button, message, Tag, Space, Typography, Input, Switch, Popconfirm, Modal, Form, InputNumber, Divider, Upload, Select, Skeleton, Alert } from 'antd';
import { ReloadOutlined, DesktopOutlined, PlayCircleOutlined, StopOutlined, DatabaseOutlined, CloudServerOutlined, SearchOutlined, EyeOutlined, DeleteOutlined, UploadOutlined, EditOutlined, BellOutlined, WarningOutlined, GlobalOutlined, EnvironmentOutlined, LockOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useVMStatusWebSocket from '../hooks/useVMStatusWebSocket';
import cloudService from '../services/cloudService';
import { getIPLocation } from '../services/geoService';
import { useFlavors, useImages, useNetworks } from '../contexts/ResourceCacheContext';
import moment from 'moment';

// Lazy load VMGlobe3D
const VMGlobe3D = React.lazy(() => import('../components/VMGlobe3D'));



// 虚拟机状态颜色配置 - 兼容 OpenStack 和本地状态
const VM_STATUS_COLORS = {
  'running': '#52c41a',
  'stopped': '#ff4d4f',
  'paused': '#faad14',
  'error': '#f5222d',
  // OpenStack 原生状态
  'ACTIVE': '#52c41a',
  'SHUTOFF': '#ff4d4f',
  'PAUSED': '#faad14',
  'ERROR': '#f5222d',
  'BUILD': '#1890ff',
  'REBUILD': '#1890ff',
  'VERIFY_RESIZE': '#722ed1',  // 紫色 - 等待确认resize
  'RESIZE': '#1890ff'
};

const CloudResources = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [servers, setServers] = useState([]);
  const [vmOverview, setVmOverview] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // 使用缓存 hooks 获取 flavors、images、networks
  const { flavors } = useFlavors();
  const { images } = useImages();
  const { networks } = useNetworks();

  // 管理员资源创建模态框状态
  const [createSystemModalVisible, setCreateSystemModalVisible] = useState(false);
  const [createVMModalVisible, setCreateVMModalVisible] = useState(false);
  const [systems, setSystems] = useState([]);
  const [selectedSystemId, setSelectedSystemId] = useState(null);

  // 虚拟机搜索状态
  const [vmSearchText, setVmSearchText] = useState('');

  // 虚拟机详情模态框状态
  const [selectedVm, setSelectedVm] = useState(null);
  const [vmDetailModalVisible, setVmDetailModalVisible] = useState(false);

  // Resize模态框状态
  const [resizeModalVisible, setResizeModalVisible] = useState(false);
  const [selectedVmForResize, setSelectedVmForResize] = useState(null);
  const [resizeForm] = Form.useForm();

  // 镜像管理状态
  const [imageUploadModalVisible, setImageUploadModalVisible] = useState(false);
  const [imageEditModalVisible, setImageEditModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageForm] = Form.useForm();

  // 3D地球状态
  const [vmGlobeData, setVmGlobeData] = useState([]);
  const [globeLoading, setGlobeLoading] = useState(false);

  // 告警管理状态
  const [alertRules, setAlertRules] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertRuleModalVisible, setAlertRuleModalVisible] = useState(false);
  const [alertRuleForm] = Form.useForm();

  // 审计日志状态
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({});

  // 浮动IP管理状态
  const [floatingIPs, setFloatingIPs] = useState([]);
  const [floatingIPsLoading, setFloatingIPsLoading] = useState(false);
  const [allocateIPModalVisible, setAllocateIPModalVisible] = useState(false);
  const [associateIPModalVisible, setAssociateIPModalVisible] = useState(false);
  const [selectedFloatingIP, setSelectedFloatingIP] = useState(null);
  const [allocateIPForm] = Form.useForm();
  const [associateIPForm] = Form.useForm();

  // 安全组管理状态
  const [securityGroups, setSecurityGroups] = useState([]);
  const [securityGroupsLoading, setSecurityGroupsLoading] = useState(false);
  const [createSGModalVisible, setCreateSGModalVisible] = useState(false);
  const [manageRulesModalVisible, setManageRulesModalVisible] = useState(false);
  const [selectedSG, setSelectedSG] = useState(null);
  const [createSGForm] = Form.useForm();
  const [addRuleForm] = Form.useForm();

  // 网络流量监控状态


  // 批量操作状态
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // 正在操作的VM集合（用于防止并发操作）
  const [vmOperations, setVmOperations] = useState(new Set());

  // WebSocket实时状态更新回调
  const handleVMStatusUpdate = useCallback((data) => {
    console.log('Updating VM status from WebSocket:', data);
    setVmOverview(prev => {
      if (!prev || !prev.virtual_machines) return prev;

      const newVMs = prev.virtual_machines.map(vm => {
        if (vm.openstack_id === data.openstack_id) {
          return { ...vm, status: data.new_status };
        }
        return vm;
      });

      return { ...prev, virtual_machines: newVMs };
    });

    // WebSocket状态更新后，解锁该VM的操作
    setVmOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(data.openstack_id);
      return newSet;
    });
  }, []);

  // 连接WebSocket
  useVMStatusWebSocket(handleVMStatusUpdate);


  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动刷新功能 - 每5秒刷新一次虚拟机数据
  useEffect(() => {
    let refreshInterval;
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        // 静默刷新，不显示loading
        fetchAllData(false);
        setLastUpdate(new Date());
      }, 5000);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);



  // 自动加载浮动IP和安全组数据（当进入网络管理页面时）
  useEffect(() => {
    if (currentPath.includes('/networks')) {
      fetchFloatingIPs();
      fetchSecurityGroups();
    }
  }, [currentPath]);


  // Debug: 监控 vmOverview 状态变化
  useEffect(() => {
    console.log('[State Update] vmOverview changed:', vmOverview);
    if (vmOverview?.compute) {
      console.log('[State Update] Compute stats:', {
        total_instances: vmOverview.compute.total_instances,
        running: vmOverview.compute.running_instances,
        stopped: vmOverview.compute.stopped_instances,
        cpu: vmOverview.compute.total_vcpu,
        ram: vmOverview.compute.total_memory_gb,
        disk: vmOverview.compute.total_disk_gb
      });
    }
  }, [vmOverview]);


  const fetchAllData = async (showLoading = true) => {
    // 只在首次加载或明确需要时显示 loading
    if (showLoading && !vmOverview?.virtual_machines?.length) {
      setLoading(true);
    }
    try {
      // 只获取 overview 和 servers，flavors/images/networks 由 hooks 自动管理
      const results = await Promise.allSettled([
        cloudService.getCloudOverview(),
        cloudService.getServers({ all_tenants: true })
      ]);

      // 处理 cloudOverview
      if (results[0].status === 'fulfilled' && results[0].value) {
        setOverview(results[0].value);
      }

      let allServers = [];
      // 处理 servers (VM列表)
      if (results[1].status === 'fulfilled' && results[1].value) {
        allServers = Array.isArray(results[1].value) ? results[1].value : [];
        setServers(allServers);

        // 基于服务器列表计算概览数据
        calculateVMOverview(allServers);
      }

    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 在前端计算虚拟机概览数据，不依赖后端数据库聚合
  const calculateVMOverview = (serversList) => {
    if (!serversList) return;

    console.log('[calculateVMOverview] Input servers:', serversList.length);

    const running = serversList.filter(s => s.status === 'ACTIVE').length;
    const stopped = serversList.filter(s => s.status === 'SHUTOFF').length;
    const error = serversList.filter(s => s.status === 'ERROR').length;

    // 计算资源总量
    // OpenStack API 已经在 server 对象中嵌入了完整的 flavor 信息
    let totalCpu = 0;
    let totalRam = 0;
    let totalDisk = 0;

    serversList.forEach(vm => {
      // 直接使用嵌入的 flavor 对象
      if (vm.flavor) {
        console.log(`[calculateVMOverview] VM ${vm.name}: flavor=`, vm.flavor);
        totalCpu += vm.flavor.vcpus || 0;
        totalRam += (vm.flavor.ram || 0) / 1024; // MB to GB
        totalDisk += vm.flavor.disk || 0;
      } else {
        console.warn(`[calculateVMOverview] VM ${vm.name} has no flavor!`);
      }
    });

    console.log('[calculateVMOverview] Calculated stats:', {
      totalCpu,
      totalRam: totalRam.toFixed(2),
      totalDisk,
      running,
      stopped,
      error
    });

    // 构建前端适配的 VM 列表对象，并解析IP地址
    // 调试：打印第一个 server 的所有字段
    if (serversList.length > 0) {
      console.log('[calculateVMOverview] Sample server data:', serversList[0]);
      console.log('[calculateVMOverview] Server created field:', serversList[0].created);
      console.log('[calculateVMOverview] Server tenant_id field:', serversList[0].tenant_id);
    }

    const formattedVMs = serversList.map(server => {
      let ipAddr = '未分配';
      if (server.addresses) {
        for (const network in server.addresses) {
          const ips = server.addresses[network];
          const ipv4 = ips.find(ip => ip.version === 4);
          if (ipv4) {
            ipAddr = ipv4.addr;
            break;
          }
        }
      }

      return {
        ...server, // 包含所有原始server数据，包括 created 和其他字段
        id: server.id,
        openstack_id: server.id,
        name: server.name || '未命名',
        // 租户显示：优先使用后端通过VM→系统→租户关系链查到的租户名
        tenant_name: server.tenant_name || (server.tenant_id ? `OpenStack-${server.tenant_id.substring(0, 8)}` : '未关联'),
        // 系统显示：优先使用后端查到的系统名
        system_name: server.system_name || '未关联系统',
        ip_address: ipAddr,
        status_display: server.status === 'ACTIVE' ? '运行中' : (server.status === 'SHUTOFF' ? '已停止' : server.status),
        // OpenStack 使用 'created' 字段，确保这里正确传递
        created_at: server.created || server.created_at || '',
        created: server.created || server.created_at || '',
        // cpu_cores, memory_gb, disk_gb will be derived from flavor in columns
        os_type: 'Linux', // 假设
        data_center_type_display: '生产中心'
      };
    });

    // 计算租户统计 - 按 tenant_name 分组
    const tenantStatsMap = {};
    formattedVMs.forEach(vm => {
      const tenantName = vm.tenant_name || '未分配';
      if (!tenantStatsMap[tenantName]) {
        tenantStatsMap[tenantName] = {
          tenant_id: tenantName,
          tenant_name: tenantName,
          total_vms: 0,
          running_vms: 0,
          total_cpu: 0,
          total_memory: 0,
          total_storage: 0
        };
      }
      const stat = tenantStatsMap[tenantName];
      stat.total_vms += 1;
      if (vm.status === 'ACTIVE') {
        stat.running_vms += 1;
      }
      // 从 flavor 获取资源
      if (vm.flavor) {
        stat.total_cpu += vm.flavor.vcpus || 0;
        stat.total_memory += Math.round((vm.flavor.ram || 0) / 1024); // MB to GB
        stat.total_storage += vm.flavor.disk || 0;
      }
    });
    const tenantStats = Object.values(tenantStatsMap);

    const overview = {
      virtual_machines: formattedVMs,
      compute: {
        total_instances: serversList.length,
        running_instances: running,
        stopped_instances: stopped,
        error_instances: error,
        total_vcpu: totalCpu,
        total_memory_gb: totalRam,
        total_disk_gb: totalDisk
      },
      tenant_stats: tenantStats
    };

    console.log('[calculateVMOverview] Setting vmOverview:', overview);
    setVmOverview(overview);
  };



  const pieData = vmOverview ? [
    { name: '运行中', value: vmOverview.compute?.running_instances || 0 },
    { name: '已停止', value: vmOverview.compute?.stopped_instances || 0 }
  ] : [];



  // 处理虚拟机删除
  const handleDeleteVM = async (vmId) => {
    try {
      // 改为直接调用 OpenStack 删除接口
      await cloudService.deleteServer(vmId);
      message.success('虚拟机删除成功');
      fetchAllData();
    } catch (error) {
      message.error(`删除失败: ${error.message || '未知错误'}`);
    }
  };

  const handleOpenResizeModal = (vm) => {
    setSelectedVmForResize(vm);
    resizeForm.resetFields();
    setResizeModalVisible(true);
  };

  const handleResizeVM = async () => {
    try {
      const values = await resizeForm.validateFields();
      const vmId = selectedVmForResize.openstack_id || selectedVmForResize.id;

      const hide = message.loading('正在提交resize请求...', 0);
      await cloudService.resizeServer(vmId, values.new_flavor_id, false); // 不自动确认
      hide();

      message.success('resize请求已提交，请等待状态变为VERIFY_RESIZE后确认或回滚');
      setResizeModalVisible(false);
      resizeForm.resetFields();
      setSelectedVmForResize(null);
      fetchAllData();
    } catch (error) {
      message.error(`配置调整失败: ${error.message || '未知错误'}`);
    }
  };

  // 确认resize
  const handleConfirmResize = async (vm) => {
    const vmId = vm.openstack_id || vm.id;
    try {
      const hide = message.loading('正在确认resize...', 0);
      await cloudService.confirmResize(vmId);
      hide();
      message.success('resize已确认');
      fetchAllData();
    } catch (error) {
      message.error(`确认resize失败: ${error.message || '未知错误'}`);
    }
  };

  // 回滚resize
  const handleRevertResize = async (vm) => {
    const vmId = vm.openstack_id || vm.id;
    try {
      const hide = message.loading('正在回滚resize...', 0);
      await cloudService.revertResize(vmId);
      hide();
      message.success('resize已回滚');
      fetchAllData();
    } catch (error) {
      message.error(`回滚resize失败: ${error.message || '未知错误'}`);
    }
  };

  //镜像管理处理函数
  const handleUploadImage = async () => {
    try {
      const values = await imageForm.validateFields();
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('disk_format', values.disk_format || 'qcow2');
      formData.append('min_disk', values.min_disk || 0);
      formData.append('min_ram', values.min_ram || 0);
      if (values.file && values.file.length > 0) {
        formData.append('file', values.file[0].originFileObj);
      }

      await cloudService.createImage(formData);
      message.success('镜像上传成功');
      setImageUploadModalVisible(false);
      imageForm.resetFields();
      fetchAllData();
    } catch (error) {
      message.error(`上传失败: ${error.message || '未知错误'}`);
    }
  };

  const handleEditImage = async () => {
    try {
      const values = await imageForm.validateFields();
      await cloudService.updateImage(selectedImage.id, values);
      message.success('镜像更新成功');
      setImageEditModalVisible(false);
      imageForm.resetFields();
      setSelectedImage(null);
      fetchAllData();
    } catch (error) {
      message.error(`更新失败: ${error.message || '未知错误'}`);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await cloudService.deleteImage(imageId);
      message.success('镜像删除成功');
      fetchAllData();
    } catch (error) {
      message.error(`删除失败: ${error.message || '未知错误'}`);
    }
  };

  // 告警管理函数
  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const [rules, history] = await Promise.all([
        api.get('/monitoring/alert-rules/'),
        api.get('/monitoring/alert-history/')
      ]);
      setAlertRules(rules || []);
      setAlertHistory(history || []);
    } catch (error) {
      console.error('获取告警数据失败:', error);
      message.error('获取告警数据失败');
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleCreateAlertRule = async () => {
    try {
      const values = await alertRuleForm.validateFields();
      await api.post('/monitoring/alert-rules/', values);
      message.success('告警规则创建成功');
      setAlertRuleModalVisible(false);
      alertRuleForm.resetFields();
      fetchAlerts();
    } catch (error) {
      message.error(`创建失败: ${error.response?.data?.message || '未知错误'}`);
    }
  };

  const handleDeleteAlertRule = async (ruleId) => {
    try {
      await api.delete(`/monitoring/alert-rules/${ruleId}/`);
      message.success('告警规则删除成功');
      fetchAlerts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 审计日志函数
  const fetchAuditLogs = async (filters = {}) => {
    setAuditLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user', filters.user_id);
      if (filters.action_type) params.append('action_type', filters.action_type);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.start_date) params.append('created_at__gte', filters.start_date);
      if (filters.end_date) params.append('created_at__lte', filters.end_date);

      const response = await api.get(`/monitoring/activities/?${params.toString()}&limit=100&full=true`);
      setAuditLogs(response.results || response || []);
    } catch (error) {
      console.error('获取审计日志失败:', error);
      message.error('获取审计日志失败');
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // 浮动IP管理函数
  const fetchFloatingIPs = async () => {
    setFloatingIPsLoading(true);
    try {
      const data = await api.get('/openstack/floating-ips/');
      setFloatingIPs(data || []);
    } catch (error) {
      console.error('获取浮动IP失败:', error);
      message.error('获取浮动IP失败');
    } finally {
      setFloatingIPsLoading(false);
    }
  };

  const handleAllocateIP = async (values) => {
    try {
      await api.post('/openstack/floating-ips/', values);
      message.success('浮动IP分配成功');
      setAllocateIPModalVisible(false);
      allocateIPForm.resetFields();
      fetchFloatingIPs();
    } catch (error) {
      console.error('分配浮动IP失败:', error);
      message.error(error.response?.data?.error || '分配浮动IP失败');
    }
  };

  const handleAssociateIP = async (values) => {
    try {
      await api.post(`/openstack/floating-ips/${selectedFloatingIP.id}/associate/`, values);
      message.success('浮动IP绑定成功');
      setAssociateIPModalVisible(false);
      associateIPForm.resetFields();
      fetchFloatingIPs();
    } catch (error) {
      console.error('绑定浮动IP失败:', error);
      message.error(error.response?.data?.error || '绑定浮动IP失败');
    }
  };

  const handleDisassociateIP = async (ipId) => {
    try {
      await api.post(`/openstack/floating-ips/${ipId}/disassociate/`, {});
      message.success('浮动IP解绑成功');
      fetchFloatingIPs();
    } catch (error) {
      console.error('解绑浮动IP失败:', error);
      message.error(error.response?.data?.error || '解绑浮动IP失败');
    }
  };

  const handleReleaseIP = async (ipId) => {
    try {
      await api.delete(`/openstack/floating-ips/${ipId}/`);
      message.success('浮动IP释放成功');
      fetchFloatingIPs();
    } catch (error) {
      console.error('释放浮动IP失败:', error);
      message.error(error.response?.data?.error || '释放浮动IP失败');
    }
  };

  // 安全组管理函数
  const fetchSecurityGroups = async () => {
    setSecurityGroupsLoading(true);
    try {
      const data = await api.get('/openstack/security-groups/');
      setSecurityGroups(data || []);
    } catch (error) {
      console.error('获取安全组失败:', error);
      message.error('获取安全组失败');
    } finally {
      setSecurityGroupsLoading(false);
    }
  };

  const handleCreateSG = async (values) => {
    try {
      await api.post('/openstack/security-groups/', values);
      message.success('创建安全组成功');
      setCreateSGModalVisible(false);
      createSGForm.resetFields();
      fetchSecurityGroups();
    } catch (error) {
      console.error('创建安全组失败:', error);
      message.error(error.response?.data?.error || '创建安全组失败');
    }
  };

  const handleDeleteSG = async (id) => {
    try {
      await api.delete(`/openstack/security-groups/${id}/`);
      message.success('删除安全组成功');
      fetchSecurityGroups();
    } catch (error) {
      console.error('删除安全组失败:', error);
      message.error(error.response?.data?.error || '删除安全组失败');
    }
  };

  const handleAddRule = async (values) => {
    try {
      await api.post(`/openstack/security-groups/${selectedSG.id}/add_rule/`, values);
      message.success('添加规则成功');
      addRuleForm.resetFields();
      // 刷新安全组列表以获取最新规则
      fetchSecurityGroups();
      // 更新选中的安全组（需要重新获取详情或从列表中更新）
      // 这里简单起见，我们重新获取列表后，可能需要更新selectedSG
      // 更好的做法是单独获取SG详情，或者从列表中找到更新后的SG
      const data = await api.get(`/openstack/security-groups/${selectedSG.id}/`);
      setSelectedSG(data);
    } catch (error) {
      console.error('添加规则失败:', error);
      message.error(error.response?.data?.error || '添加规则失败');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await api.delete(`/openstack/security-groups/${selectedSG.id}/rules/${ruleId}/`);
      message.success('删除规则成功');
      // 刷新并更新selectedSG
      const data = await api.get(`/openstack/security-groups/${selectedSG.id}/`);
      setSelectedSG(data);
      fetchSecurityGroups();
    } catch (error) {
      console.error('删除规则失败:', error);
      message.error(error.response?.data?.error || '删除规则失败');
    }
  };



  // VM电源管理函数
  const handleVMPowerAction = async (vmId, action, actionName) => {
    // 检查是否已有操作在进行
    if (vmOperations.has(vmId)) {
      message.warning('该虚拟机正在执行操作，请等待完成');
      return;
    }

    // 标记VM为操作中
    setVmOperations(prev => new Set(prev).add(vmId));

    try {
      const hide = message.loading(`正在${actionName}中...`, 0);

      await api.post(`/openstack/servers/${vmId}/${action}/`,
        action === 'reboot' ? { type: 'SOFT' } : {}
      );

      hide();
      message.success(`${actionName}命令已发送！`, 2);

      // ✅ 操作成功：立即解锁按钮
      setVmOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(vmId);
        return newSet;
      });

      // 静默刷新数据以获取真实状态（不显示loading）
      fetchAllData(false);

    } catch (error) {
      console.error(`${actionName}失败:`, error);
      const errorMsg = error.response?.data?.error || error.message;

      if (errorMsg.includes('Conflict') || error.response?.status === 409) {
        message.warning(`VM可能已经在${actionName}中或已完成`);
      } else {
        message.error(errorMsg || `${actionName}失败`);
      }

      // ❌ 操作失败：立即解锁，允许用户重试
      setVmOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(vmId);
        return newSet;
      });

      // 刷新获取真实状态
      fetchAllData();
    }
  };

  // 批量操作函数
  const handleBatchAction = async (action, actionName) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的VM');
      return;
    }

    Modal.confirm({
      title: `确认${actionName}`,
      content: `确定要对选中的 ${selectedRowKeys.length} 个VM执行${actionName}吗？`,
      onOk: async () => {
        setBatchActionLoading(true);
        try {
          const response = await api.post('/openstack/servers/batch_action/',
            {
              action,
              vm_ids: selectedRowKeys
            }
          );

          const { results } = response;
          message.success(
            `批量${actionName}完成：成功 ${results.success.length} 个，失败 ${results.failed.length} 个`,
            5
          );

          if (results.failed.length > 0) {
            console.error('失败的VM:', results.failed);
          }

          setSelectedRowKeys([]); //清除选择
          fetchAllData(); // 刷新VM列表
        } catch (error) {
          console.error(`批量${actionName}失败:`, error);
          message.error(error.response?.data?.error || `批量${actionName}失败`);
        } finally {
          setBatchActionLoading(false);
        }
      }
    });
  };





  // 准备3D地球数据（添加地理位置信息）
  const prepareGlobeData = async (vms) => {
    console.log('=== 开始准备3D地球数据 ===');
    console.log('虚拟机总数:', vms?.length);

    if (!vms || vms.length === 0) {
      console.log('没有虚拟机数据');
      setVmGlobeData([]);
      return;
    }

    setGlobeLoading(true);

    try {
      // 取前50个VM（避免API限流）
      const vmsToProcess = vms.slice(0, 50);
      console.log('准备处理VM数量:', vmsToProcess.length);

      // 先打印第一个VM的数据结构
      if (vmsToProcess.length > 0) {
        console.log('第一个VM数据示例:', vmsToProcess[0]);
      }

      const enrichedVMs = await Promise.all(
        vmsToProcess.map(async (vm, index) => {
          // 尝试多个可能的IP字段名
          const ip = vm.ip_address || vm.ip || vm.fixed_ip || vm.floating_ip;

          if (ip && ip !== '-' && ip !== 'N/A' && ip !== '') {
            try {
              console.log(`[${index + 1}/${vmsToProcess.length}] 查询IP: ${ip}`);
              const location = await getIPLocation(ip);

              if (location) {
                console.log(`✓ IP ${ip} 定位成功:`, location.city, location.country);
                return {
                  ...vm,
                  latitude: location.lat,
                  longitude: location.lon,
                  city: location.city,
                  country: location.country
                };
              } else {
                console.log(`✗ IP ${ip} 定位失败`);
              }
            } catch (error) {
              console.error(`获取IP ${ip} 位置失败:`, error);
            }
          } else {
            console.log(`VM ${vm.name || index} 没有有效IP地址:`, ip);
          }
          return vm;
        })
      );

      const validVMs = enrichedVMs.filter(vm => vm.latitude && vm.longitude);
      console.log('有地理位置的VM数量:', validVMs.length);
      console.log('有地理位置的VM:', validVMs);

      setVmGlobeData(validVMs);
    } catch (error) {
      console.error('准备地球数据失败:', error);
      message.error('加载地理位置数据失败: ' + error.message);
    } finally {
      setGlobeLoading(false);
    }
  };

  // 监听vmOverview变化，更新3D地球数据
  useEffect(() => {
    // Only prepare globe data if we are on the globe view
    if (currentPath.includes('/globe') && vmOverview?.virtual_machines) {
      console.log('vmOverview.virtual_machines 更新，触发地球数据准备');
      prepareGlobeData(vmOverview.virtual_machines);
    } else {
      console.log('跳过地球数据准备: 不在地球视图或无数据');
    }
  }, [vmOverview, currentPath]);

  // 虚拟机状态饼图数据
  const getVMStatusPieData = () => {
    if (!vmOverview || !vmOverview.compute) return [];

    const { compute } = vmOverview;
    return [
      { name: '运行中', value: compute.running_instances || 0, color: VM_STATUS_COLORS.running },
      { name: '已停止', value: compute.stopped_instances || 0, color: VM_STATUS_COLORS.stopped },
      // Assuming 'paused' and 'error' instances might be part of compute overview if available
      // For now, using 0 if not explicitly provided in the new compute structure
      { name: '已暂停', value: compute.paused_instances || 0, color: VM_STATUS_COLORS.paused },
      { name: '异常', value: compute.error_instances || 0, color: VM_STATUS_COLORS.error }
    ].filter(item => item.value > 0);
  };

  // 虚拟机状态饼图组件
  const VMStatusChart = () => {
    const data = getVMStatusPieData();
    if (data.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <DesktopOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <p>暂无虚拟机数据</p>
        </div>
      );
    }

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);

      return (
        <text
          x={x}
          y={y}
          fill="white"
          textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central"
          fontWeight="bold"
        >
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      );
    };

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // 虚拟机表格列定义
  const vmColumns = [
    {
      title: '虚拟机名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || '')
    },
    {
      title: '租户',
      key: 'tenant',
      width: 150,
      sorter: (a, b) => {
        const tenantA = a.tenant_name || a.project_name || a.tenant || '';
        const tenantB = b.tenant_name || b.project_name || b.tenant || '';
        return tenantA.localeCompare(tenantB);
      },
      render: (_, record) => {
        // 尝试多个可能的租户字段
        const tenantName = record.tenant_name ||
          record.project_name ||
          record['OS-EXT-AZ:project_name'] ||
          record.tenant ||
          'OpenStack资源';
        return tenantName;
      }
    },
    {
      title: '所属系统',
      key: 'system',
      width: 130,
      sorter: (a, b) => (a.system_name || '').localeCompare(b.system_name || ''),
      render: (_, record) => {
        // OpenStack resources don't have system_name, show placeholder
        return record.system_name || 'OpenStack资源';
      }
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      sorter: (a, b) => (a.ip_address || '').localeCompare(b.ip_address || '')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
      render: (status, record) => {
        // OpenStack 状态映射到中文显示
        const statusMap = {
          'ACTIVE': '运行中',
          'SHUTOFF': '已停止',
          'PAUSED': '已暂停',
          'ERROR': '错误',
          'BUILD': '创建中',
          'REBUILD': '重建中',
          'running': '运行中',
          'stopped': '已停止',
          'paused': '已暂停',
          'error': '错误'
        };
        const displayStatus = statusMap[status] || record.status_display || status;
        return (
          <Tag color={VM_STATUS_COLORS[status] || 'default'}>
            {displayStatus}
          </Tag>
        );
      }
    },
    {
      title: '运行时长',
      key: 'uptime',
      width: 140,
      sorter: (a, b) => {
        const getTime = (r) => r.launched_at ? new Date(r.launched_at).getTime() : 0;
        return getTime(a) - getTime(b);
      },
      render: (_, record) => {
        // OpenStack 返回 launched_at 时间戳
        if (record.launched_at && (record.status === 'ACTIVE' || record.status === 'running')) {
          const launchedAt = moment(record.launched_at);
          const now = moment();
          const duration = moment.duration(now.diff(launchedAt));
          const days = Math.floor(duration.asDays());
          const hours = duration.hours();
          const minutes = duration.minutes();

          // 始终显示到分钟精度
          if (days > 0) {
            return `${days}天${hours}小时${minutes}分钟`;
          } else if (hours > 0) {
            return `${hours}小时${minutes}分钟`;
          } else {
            return `${minutes}分钟`;
          }
        }
        return record.uptime || '未运行';
      }
    },
    {
      title: 'CPU',
      key: 'cpu',
      width: 80,
      sorter: (a, b) => (a.flavor?.vcpus || 0) - (b.flavor?.vcpus || 0),
      render: (_, record) => {
        // OpenStack API 已经嵌入了完整的 flavor 对象，直接使用
        const vcpus = record.flavor?.vcpus;
        return vcpus ? `${vcpus}核` : '-';
      }
    },
    {
      title: '内存',
      key: 'memory',
      width: 80,
      sorter: (a, b) => (a.flavor?.ram || 0) - (b.flavor?.ram || 0),
      render: (_, record) => {
        const ram = record.flavor?.ram;
        return ram ? `${(ram / 1024).toFixed(1)}GB` : '-';
      }
    },
    {
      title: '磁盘',
      key: 'disk',
      width: 80,
      sorter: (a, b) => (a.flavor?.disk || 0) - (b.flavor?.disk || 0),
      render: (_, record) => {
        const disk = record.flavor?.disk;
        return disk ? `${disk}GB` : '-';
      }
    },
    {
      title: '数据中心',
      dataIndex: 'data_center_type_display',
      key: 'data_center_type',
      width: 100,
      sorter: (a, b) => (a.data_center_type_display || '').localeCompare(b.data_center_type_display || '')
    },
    {
      title: '操作系统',
      dataIndex: 'os_type',
      key: 'os_type',
      width: 100,
      sorter: (a, b) => (a.os_type || '').localeCompare(b.os_type || '')
    },
    {
      title: 'OpenStack ID',
      key: 'openstack_id',
      width: 280,
      render: (_, record) => {
        const id = record.id || record.openstack_id;
        return (
          <span style={{ fontSize: '12px', fontFamily: 'monospace' }} title={id}>
            {id}
          </span>
        );
      }
    },
    {
      title: '创建时间',
      key: 'created',
      width: 160,
      sorter: (a, b) => {
        const timeA = a.created || a.created_at || '';
        const timeB = b.created || b.created_at || '';
        return new Date(timeA).getTime() - new Date(timeB).getTime();
      },
      render: (_, record) => {
        // OpenStack uses 'created' field
        const createdTime = record.created || record.created_at;
        return createdTime ? moment(createdTime).format('YYYY-MM-DD HH:mm') : '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => {
        const status = record.status?.toUpperCase();
        const isRunning = status === 'ACTIVE' || status === 'RUNNING';
        const isStopped = status === 'SHUTOFF' || status === 'STOPPED';
        const isPaused = status === 'PAUSED';
        const isVerifyResize = status === 'VERIFY_RESIZE';

        return (
          <Space wrap>
            {/* VERIFY_RESIZE 状态 - 优先显示确认/回滚按钮 */}
            {isVerifyResize && (
              <>
                <Button
                  size="small"
                  type="primary"
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => handleConfirmResize(record)}
                >
                  ✅ 确认Resize
                </Button>
                <Button
                  size="small"
                  onClick={() => handleRevertResize(record)}
                >
                  ↩️ 回滚
                </Button>
              </>
            )}

            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedVm(record);
                setVmDetailModalVisible(true);
              }}
            >
              详情
            </Button>

            {isStopped && (
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleVMPowerAction(record.openstack_id, 'start', '启动')}
                disabled={vmOperations.has(record.openstack_id)}
                loading={vmOperations.has(record.openstack_id)}
              >
                启动
              </Button>
            )}

            {isRunning && (
              <>
                <Button
                  size="small"
                  icon={<StopOutlined />}
                  onClick={() => handleVMPowerAction(record.openstack_id, 'stop', '停止')}
                  disabled={vmOperations.has(record.openstack_id)}
                  loading={vmOperations.has(record.openstack_id)}
                >
                  停止
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => handleVMPowerAction(record.openstack_id, 'reboot', '重启')}
                  disabled={vmOperations.has(record.openstack_id)}
                  loading={vmOperations.has(record.openstack_id)}
                >
                  重启
                </Button>
              </>
            )}

            {isPaused && (
              <Button
                size="small"
                type="primary"
                onClick={() => handleVMPowerAction(record.openstack_id, 'unpause', '恢复')}
                disabled={vmOperations.has(record.openstack_id)}
                loading={vmOperations.has(record.openstack_id)}
              >
                恢复
              </Button>
            )}

            {isStopped && (
              <>
                <Button
                  size="small"
                  icon={<DesktopOutlined />}
                  onClick={() => handleOpenResizeModal(record)}
                >
                  调整配置
                </Button>
                <Popconfirm
                  title="确定删除此虚拟机吗？"
                  description="删除后数据将无法恢复，请谨慎操作"
                  onConfirm={() => handleDeleteVM(record.id)}
                  okText="确定"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        );
      }
    }
  ];

  // 租户统计表格列定义
  const tenantStatsColumns = [
    { title: '租户名称', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: '虚拟机总数', dataIndex: 'total_vms', key: 'total_vms' },
    { title: '运行中', dataIndex: 'running_vms', key: 'running_vms' },
    { title: 'CPU总计', dataIndex: 'total_cpu', key: 'total_cpu', render: (cpu) => `${cpu}核` },
    { title: '内存总计', dataIndex: 'total_memory', key: 'total_memory', render: (mem) => `${mem}GB` },
    { title: '存储总计', dataIndex: 'total_storage', key: 'total_storage', render: (disk) => `${disk}GB` }
  ];

  // 虚拟机列表过滤
  const getFilteredVMs = () => {
    // 优先使用 vmOverview.virtual_machines，否则降级到 servers
    const vms = (vmOverview && vmOverview.virtual_machines) || servers || [];

    if (!vmSearchText) return vms;

    const searchLower = vmSearchText.toLowerCase();
    return vms.filter(vm =>
      (vm.name && vm.name.toLowerCase().includes(searchLower)) ||
      (vm.tenant_name && vm.tenant_name.toLowerCase().includes(searchLower)) ||
      (vm.system_name && vm.system_name.toLowerCase().includes(searchLower)) ||
      (vm.ip_address && vm.ip_address.toLowerCase().includes(searchLower))
    );
  };

  // 快捷操作
  const quickActions = [
    {
      title: '为租户建系统',
      icon: <DatabaseOutlined />,
      color: '#722ed1',
      onClick: () => setCreateSystemModalVisible(true)
    },
    {
      title: '为租户建VM',
      icon: <CloudServerOutlined />,
      color: '#13c2c2',
      onClick: () => setCreateVMModalVisible(true)
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ padding: '24px' }}>
        <div>

          {/* 统计卡片和快捷操作已移至下方虚拟机管理区域，避免重复显示 */}

          {(currentPath.includes('/vms') || currentPath === '/cloud-resources' || currentPath === '/cloud-resources/') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                  <DesktopOutlined /> 虚拟机管理
                </div>
                <Space>
                  <Button
                    type="primary"
                    icon={<DatabaseOutlined />}
                    style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                    onClick={() => setCreateSystemModalVisible(true)}
                  >
                    为租户建系统
                  </Button>
                  <Button
                    type="primary"
                    icon={<CloudServerOutlined />}
                    style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                    onClick={() => setCreateVMModalVisible(true)}
                  >
                    为租户建VM
                  </Button>
                </Space>
              </div>
              {vmOverview ? (
                <>
                  {/* 虚拟机统计卡片 */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={4}>
                      <Card>
                        <Statistic
                          title="虚拟机总数"
                          value={vmOverview?.compute?.total_instances || 0}
                          suffix="台"
                        />
                      </Card>
                    </Col>
                    <Col span={4}>
                      <Card>
                        <Statistic
                          title="运行中"
                          value={vmOverview?.compute?.running_instances || 0}
                          suffix="台"
                          valueStyle={{ color: VM_STATUS_COLORS.ACTIVE }}
                        />
                      </Card>
                    </Col>
                    <Col span={4}>
                      <Card>
                        <Statistic
                          title="已停止"
                          value={vmOverview?.compute?.stopped_instances || 0}
                          suffix="台"
                          valueStyle={{ color: VM_STATUS_COLORS.SHUTOFF }}
                        />
                      </Card>
                    </Col>
                    <Col span={4}>
                      <Card>
                        <Statistic
                          title="CPU总计"
                          value={vmOverview?.compute?.total_vcpu || 0}
                          suffix="核"
                        />
                      </Card>
                    </Col>
                    <Col span={4}>
                      <Card>
                        <Statistic
                          title="内存总计"
                          value={vmOverview?.compute?.total_memory_gb?.toFixed(0) || 0}
                          suffix="GB"
                        />
                      </Card>
                    </Col>
                    <Col span={4}>
                      <Card>
                        <Statistic
                          title="存储总计"
                          value={vmOverview?.compute?.total_disk_gb || 0}
                          suffix="GB"
                        />
                      </Card>
                    </Col>
                  </Row>

                  {/* 虚拟机状态图表和刷新控制 */}
                  <Card
                    title="虚拟机状态分布"
                    extra={
                      <Space>
                        <Space style={{ marginRight: 16 }}>
                          {/* 移除自动刷新开关 */}
                        </Space>

                        <Button
                          type="primary"
                          icon={<ReloadOutlined />}
                          onClick={fetchAllData}
                          loading={loading}
                        >
                          刷新数据
                        </Button>

                        <span style={{ fontSize: '12px', color: '#999', marginLeft: 8 }}>
                          最后更新: {lastUpdate.toLocaleTimeString()}
                        </span>
                      </Space>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <VMStatusChart />
                  </Card>

                  {/* 租户虚拟机统计 */}
                  <Card title="租户虚拟机统计" style={{ marginBottom: 16 }}>
                    <Table
                      dataSource={vmOverview.tenant_stats || []}
                      columns={tenantStatsColumns}
                      rowKey="tenant_id"
                      pagination={false}
                    />
                  </Card>

                  { /* 批量操作栏 */}
                  {selectedRowKeys.length > 0 && (
                    <Alert
                      message={`已选择 ${selectedRowKeys.length} 个VM`}
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      action={
                        <Space>
                          <Button
                            size="small"
                            loading={batchActionLoading}
                            onClick={() => handleBatchAction('start', '启动')}
                          >
                            批量启动
                          </Button>
                          <Button
                            size="small"
                            loading={batchActionLoading}
                            onClick={() => handleBatchAction('stop', '停止')}
                          >
                            批量停止
                          </Button>
                          <Button
                            size="small"
                            loading={batchActionLoading}
                            onClick={() => handleBatchAction('reboot', '重启')}
                          >
                            批量重启
                          </Button>
                          <Button
                            size="small"
                            danger
                            loading={batchActionLoading}
                            onClick={() => handleBatchAction('delete', '删除')}
                          >
                            批量删除
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setSelectedRowKeys([])}
                          >
                            取消选择
                          </Button>
                        </Space>
                      }
                    />
                  )}

                  {/* 虚拟机列表表格 */}
                  <Card
                    title="虚拟机列表（最近50台）"
                    extra={
                      <Input
                        placeholder="搜索虚拟机名称、租户、系统或IP"
                        prefix={<SearchOutlined />}
                        value={vmSearchText}
                        onChange={(e) => setVmSearchText(e.target.value)}
                        allowClear
                        style={{ width: 300 }}
                      />
                    }
                  >
                    <Table
                      dataSource={getFilteredVMs()}
                      columns={vmColumns}
                      rowKey="id"
                      loading={loading}
                      scroll={{ x: 1500 }}
                      pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 台虚拟机` }}
                      rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                        getCheckboxProps: (record) => ({
                          name: record.name,
                        }),
                      }}
                    />
                  </Card>
                </>
              ) : (
                <div style={{ padding: '24px' }}>
                  <Skeleton active paragraph={{ rows: 10 }} />
                </div>
              )}
            </motion.div>
          )}


          {
            currentPath.includes('/images') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                  <DatabaseOutlined /> 镜像管理
                </div>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => setImageUploadModalVisible(true)}
                  >
                    上传镜像
                  </Button>
                </Space>
                <Table
                  dataSource={images}
                  rowKey="id"
                  loading={loading}
                  columns={[
                    { title: '名称', dataIndex: 'name', key: 'name' },
                    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
                    { title: '格式', dataIndex: 'disk_format', key: 'disk_format' },
                    {
                      title: '状态', dataIndex: 'status', key: 'status',
                      render: (status) => <Tag color={status === 'active' ? 'green' : 'orange'}>{status}</Tag>
                    },
                    { title: '最小磁盘(GB)', dataIndex: 'min_disk', key: 'min_disk' },
                    { title: '最小内存(MB)', dataIndex: 'min_ram', key: 'min_ram' },
                    {
                      title: '操作',
                      key: 'action',
                      render: (_, record) => (
                        <Space>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                              setSelectedImage(record);
                              imageForm.setFieldsValue({
                                name: record.name,
                                min_disk: record.min_disk,
                                min_ram: record.min_ram
                              });
                              setImageEditModalVisible(true);
                            }}
                          >
                            编辑
                          </Button>
                          <Popconfirm
                            title="确定删除此镜像吗？"
                            description="删除后无法恢复"
                            onConfirm={() => handleDeleteImage(record.id)}
                            okText="确定"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      )
                    }
                  ]}
                />
              </motion.div>
            )
          }

          {
            currentPath.includes('/networks') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                  <GlobalOutlined /> 网络管理
                </div>
                <Table
                  dataSource={networks}
                  rowKey="id"
                  loading={loading}
                  expandable={{
                    expandedRowRender: (record) => (
                      <div style={{ padding: '12px 24px', background: '#f5f5f5' }}>
                        <p style={{ margin: '4px 0' }}><strong>子网列表：</strong></p>
                        {record.subnets && record.subnets.length > 0 ? (
                          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                            {record.subnets.map(subnet => (
                              <li key={subnet.id}>
                                <strong>{subnet.name || subnet.id}</strong>: {subnet.cidr}
                                {subnet.gateway_ip && ` (网关: ${subnet.gateway_ip})`}
                                {subnet.enable_dhcp && <Tag color="blue" style={{ marginLeft: 8 }}>DHCP</Tag>}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ color: '#999' }}>暂无子网</p>
                        )}
                      </div>
                    ),
                    rowExpandable: (record) => record.subnet_count > 0,
                  }}
                  columns={[
                    {
                      title: '网络名称',
                      dataIndex: 'name',
                      width: 200
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: (status) => (
                        <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>
                          {status || 'UNKNOWN'}
                        </Tag>
                      )
                    },
                    {
                      title: '类型',
                      dataIndex: 'network_type',
                      width: 120,
                      render: (type) => {
                        const typeConfig = {
                          'external': { color: 'orange', text: '外部网络' },
                          'shared': { color: 'blue', text: '共享网络' },
                          'private': { color: 'green', text: '私有网络' }
                        };
                        const config = typeConfig[type] || { color: 'default', text: type || '-' };
                        return <Tag color={config.color}>{config.text}</Tag>;
                      }
                    },
                    {
                      title: '子网数',
                      dataIndex: 'subnet_count',
                      width: 80,
                      render: (count) => count || 0
                    },
                    {
                      title: 'MTU',
                      dataIndex: 'mtu',
                      width: 80,
                      render: (mtu) => mtu || '-'
                    },
                    {
                      title: 'ID',
                      dataIndex: 'id',
                      ellipsis: true,
                      width: 250
                    }
                  ]}
                />

                {/* 浮动IP管理部分 */}
                <div style={{ marginTop: 32 }}>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                      <GlobalOutlined /> 浮动IP管理
                    </div>
                    <Button
                      type="primary"
                      onClick={() => {
                        setAllocateIPModalVisible(true);
                      }}
                    >
                      分配浮动IP
                    </Button>
                  </div>
                  <Table
                    dataSource={floatingIPs}
                    rowKey="id"
                    loading={floatingIPsLoading}
                    columns={[
                      {
                        title: 'IP地址',
                        dataIndex: 'floating_ip_address',
                        width: 150
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        width: 100,
                        render: (status) => (
                          <Tag color={status === 'associated' ? 'green' : 'orange'}>
                            {status === 'associated' ? '已绑定' : '可用'}
                          </Tag>
                        )
                      },
                      {
                        title: '绑定端口',
                        dataIndex: 'port_id',
                        ellipsis: true,
                        width: 250,
                        render: (port_id) => port_id || '-'
                      },
                      {
                        title: 'ID',
                        dataIndex: 'id',
                        ellipsis: true,
                        width: 250
                      },
                      {
                        title: '操作',
                        width: 200,
                        render: (_, record) => (
                          <Space>
                            {record.status === 'available' && (
                              <Button
                                size="small"
                                onClick={() => {
                                  setSelectedFloatingIP(record);
                                  setAssociateIPModalVisible(true);
                                }}
                              >
                                绑定
                              </Button>
                            )}
                            {record.status === 'associated' && (
                              <Button
                                size="small"
                                onClick={() => {
                                  Modal.confirm({
                                    title: '确认解绑',
                                    content: `确定要解绑浮动IP ${record.floating_ip_address} 吗？`,
                                    onOk: () => handleDisassociateIP(record.id)
                                  });
                                }}
                              >
                                解绑
                              </Button>
                            )}
                            <Button
                              size="small"
                              danger
                              onClick={() => {
                                Modal.confirm({
                                  title: '确认释放',
                                  content: `确定要释放浮动IP ${record.floating_ip_address} 吗？此操作不可撤销。`,
                                  onOk: () => handleReleaseIP(record.id)
                                });
                              }}
                            >
                              释放
                            </Button>
                          </Space>
                        )
                      }
                    ]}
                  />
                </div>

                {/* 安全组管理部分 */}
                <div style={{ marginTop: 32 }}>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                      <LockOutlined /> 安全组管理
                    </div>
                    <Button
                      type="primary"
                      onClick={() => {
                        setCreateSGModalVisible(true);
                      }}
                    >
                      创建安全组
                    </Button>
                  </div>
                  <Table
                    dataSource={securityGroups}
                    rowKey="id"
                    loading={securityGroupsLoading}
                    columns={[
                      { title: '名称', dataIndex: 'name', width: 200 },
                      { title: '描述', dataIndex: 'description', ellipsis: true },
                      { title: 'ID', dataIndex: 'id', width: 300, ellipsis: true },
                      {
                        title: '操作',
                        width: 200,
                        render: (_, record) => (
                          <Space>
                            <Button
                              size="small"
                              onClick={() => {
                                setSelectedSG(record);
                                setManageRulesModalVisible(true);
                              }}
                            >
                              规则管理
                            </Button>
                            <Button
                              size="small"
                              danger
                              onClick={() => {
                                Modal.confirm({
                                  title: '确认删除',
                                  content: `确定要删除安全组 ${record.name} 吗？`,
                                  onOk: () => handleDeleteSG(record.id)
                                });
                              }}
                            >
                              删除
                            </Button>
                          </Space>
                        )
                      }
                    ]}
                  />
                </div>
              </motion.div>
            )
          }

          {
            currentPath.includes('/globe') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                  <EnvironmentOutlined /> 3D地图
                </div>
                <Suspense fallback={<Skeleton active paragraph={{ rows: 10 }} />}>
                  <VMGlobe3D vmData={vmGlobeData} loading={globeLoading} />
                </Suspense>
              </motion.div>
            )
          }

          {
            currentPath.includes('/alerts') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                  <BellOutlined /> 告警管理
                </div>
                <div>
                  <Space style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<BellOutlined />}
                      onClick={() => {
                        alertRuleForm.resetFields();
                        setAlertRuleModalVisible(true);
                      }}
                    >
                      创建告警规则
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={fetchAlerts}
                    >
                      刷新
                    </Button>
                  </Space>

                  <h3>告警规则</h3>
                  <Table
                    dataSource={alertRules}
                    rowKey="id"
                    loading={alertsLoading}
                    columns={[
                      { title: '规则名称', dataIndex: 'name' },
                      {
                        title: '监控指标',
                        dataIndex: 'metric_type',
                        render: (type) => {
                          const typeMap = {
                            cpu: 'CPU使用率',
                            memory: '内存使用率',
                            disk: '磁盘使用率',
                            network_in: '网络入流量',
                            network_out: '网络出流量'
                          };
                          return typeMap[type] || type;
                        }
                      },
                      {
                        title: '阈值条件',
                        render: (_, record) => `${record.operator === 'gt' ? '>' : '<'} ${record.threshold}%`
                      },
                      { title: '持续时间', dataIndex: 'duration', render: (min) => `${min}分钟` },
                      {
                        title: '关联VM',
                        dataIndex: 'virtual_machine_name',
                        render: (name) => name || <Tag>全局规则</Tag>
                      },
                      {
                        title: '状态',
                        dataIndex: 'enabled',
                        render: (enabled) => <Tag color={enabled ? 'green' : 'red'}>{enabled ? '启用' : '禁用'}</Tag>
                      },
                      {
                        title: '操作',
                        render: (_, record) => (
                          <Popconfirm
                            title="确定删除此告警规则吗？"
                            onConfirm={() => handleDeleteAlertRule(record.id)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                          </Popconfirm>
                        )
                      }
                    ]}
                  />

                  <Divider />

                  <h3>告警历史</h3>
                  <Table
                    dataSource={alertHistory}
                    rowKey="id"
                    loading={alertsLoading}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (status) => (
                          <Tag icon={<WarningOutlined />} color={status === 'active' ? 'error' : 'success'}>
                            {status === 'active' ? '触发中' : '已恢复'}
                          </Tag>
                        )
                      },
                      { title: '告警规则', dataIndex: 'rule_name' },
                      { title: '虚拟机', dataIndex: 'virtual_machine_name' },
                      { title: '告警内容', dataIndex: 'message' },
                      { title: '触发值', dataIndex: 'metric_value', render: (val) => `${val}%` },
                      { title: '开始时间', dataIndex: 'started_at', render: (time) => new Date(time).toLocaleString() },
                      {
                        title: '恢复时间',
                        dataIndex: 'resolved_at',
                        render: (time) => time ? new Date(time).toLocaleString() : '-'
                      }
                    ]}
                  />
                </div>
              </motion.div>
            )
          }

          {
            currentPath.includes('/audit') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                  <SearchOutlined /> 操作审计
                </div>
                <div>
                  <Space style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={() => fetchAuditLogs(auditFilters)}
                    >
                      查询
                    </Button>
                    <Select
                      placeholder="操作类型"
                      style={{ width: 150 }}
                      allowClear
                      onChange={(value) => setAuditFilters({ ...auditFilters, action_type: value })}
                    >
                      <Select.Option value="create">创建</Select.Option>
                      <Select.Option value="update">更新</Select.Option>
                      <Select.Option value="delete">删除</Select.Option>
                      <Select.Option value="start">启动</Select.Option>
                      <Select.Option value="stop">停止</Select.Option>
                      <Select.Option value="resize">调整配置</Select.Option>
                      <Select.Option value="snapshot">创建快照</Select.Option>
                    </Select>
                    <Select
                      placeholder="资源类型"
                      style={{ width: 150 }}
                      allowClear
                      onChange={(value) => setAuditFilters({ ...auditFilters, resource_type: value })}
                    >
                      <Select.Option value="vm">虚拟机</Select.Option>
                      <Select.Option value="image">镜像</Select.Option>
                      <Select.Option value="snapshot">快照</Select.Option>
                      <Select.Option value="alert_rule">告警规则</Select.Option>
                      <Select.Option value="tenant">租户</Select.Option>
                      <Select.Option value="user">用户</Select.Option>
                    </Select>
                  </Space>

                  <Table
                    dataSource={auditLogs}
                    rowKey="id"
                    loading={auditLogsLoading}
                    pagination={{ pageSize: 20 }}
                    columns={[
                      {
                        title: '时间',
                        dataIndex: 'created_at',
                        render: (time) => new Date(time).toLocaleString(),
                        width: 180
                      },
                      {
                        title: '用户',
                        dataIndex: 'username',
                        render: (name) => name || '系统',
                        width: 120
                      },
                      {
                        title: '操作',
                        dataIndex: 'action_type_display',
                        width: 100
                      },
                      {
                        title: '资源类型',
                        dataIndex: 'resource_type_display',
                        width: 100
                      },
                      {
                        title: '资源名称',
                        dataIndex: 'resource_name',
                        render: (name) => name || '-',
                        width: 150
                      },
                      {
                        title: '描述',
                        dataIndex: 'description',
                        ellipsis: true
                      },
                      {
                        title: '状态',
                        dataIndex: 'status_display',
                        width: 80,
                        render: (text, record) => (
                          <Tag color={record.status === 'success' ? 'green' : 'red'}>
                            {text}
                          </Tag>
                        )
                      },
                      {
                        title: 'IP地址',
                        dataIndex: 'ip_address',
                        width: 140
                      }
                    ]}
                    expandable={{
                      expandedRowRender: (record) => (
                        <div style={{ padding: '10px', background: '#f5f5f5' }}>
                          <p><strong>请求路径:</strong> {record.request_path || '-'}</p>
                          <p><strong>请求方法:</strong> {record.request_method || '-'}</p>
                          <p><strong>用户代理:</strong> {record.user_agent || '-'}</p>
                          {record.changes && (
                            <div>
                              <strong>变更详情:</strong>
                              <pre style={{ background: '#fff', padding: '10px', marginTop: '5px' }}>
                                {JSON.stringify(record.changes, null, 2)}
                              </pre>
                            </div>
                          )}
                          {record.error_message && (
                            <p style={{ color: 'red' }}>
                              <strong>错误信息:</strong> {record.error_message}
                            </p>
                          )}
                        </div>
                      )
                    }}
                  />
                </div>
              </motion.div>
            )
          }
        </div >
      </div >

      {/* 创建信息系统 */}
      <AdminResourceCreate
        visible={createSystemModalVisible}
        type="system"
        onCancel={() => setCreateSystemModalVisible(false)}
        onSuccess={() => {
          message.success('信息系统创建成功');
          fetchAllData();
        }}
      />

      {/* 创建虚拟机 */}
      <VMCreateWizard
        visible={createVMModalVisible}
        onCancel={() => setCreateVMModalVisible(false)}
        onSuccess={() => {
          message.success('虚拟机创建成功');
          fetchAllData();
        }}
        systems={systems}
        selectedSystemId={selectedSystemId}
        isAdmin={true}
      />

      <VMDetailModal
        visible={vmDetailModalVisible}
        vm={selectedVm}
        flavors={flavors}
        onClose={() => {
          setVmDetailModalVisible(false);
          setSelectedVm(null);
        }}
        onRefresh={fetchAllData}
      />

      {/* 虚拟机配置调整模态框 */}
      <Modal
        title="调整虚拟机配置"
        open={resizeModalVisible}
        onOk={handleResizeVM}
        onCancel={() => {
          setResizeModalVisible(false);
          resizeForm.resetFields();
          setSelectedVmForResize(null);
        }}
        okText="提交resize"
        cancelText="取消"
      >
        {selectedVmForResize && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>虚拟机名称：</strong>{selectedVmForResize.name}</p>
            <p><strong>当前配置：</strong>
              {selectedVmForResize.flavor?.name || '未知'}
              ({selectedVmForResize.flavor?.vcpus || '?'}核 /
              {selectedVmForResize.flavor?.ram ? Math.round(selectedVmForResize.flavor.ram / 1024) : '?'}GB RAM /
              {selectedVmForResize.flavor?.disk || '?'}GB 磁盘)
            </p>
            <Divider />
          </div>
        )}
        <Form form={resizeForm} layout="vertical">
          <Form.Item
            label="选择新的实例类型 (Flavor)"
            name="new_flavor_id"
            rules={[{ required: true, message: '请选择新的实例类型' }]}
          >
            <Select placeholder="选择新配置" showSearch optionFilterProp="children">
              {flavors
                .filter(f => f.id !== selectedVmForResize?.flavor?.id)
                .map(flavor => (
                  <Select.Option key={flavor.id} value={flavor.id}>
                    {flavor.name} ({flavor.vcpus}核 / {Math.round(flavor.ram / 1024)}GB / {flavor.disk}GB)
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
        <Alert
          type="warning"
          showIcon
          message="Resize注意事项"
          description={
            <div>
              <p style={{ margin: '4px 0' }}>• VM会在resize期间重启</p>
              <p style={{ margin: '4px 0' }}>• 提交后VM状态变为VERIFY_RESIZE</p>
              <p style={{ margin: '4px 0' }}>• 您可以在新配置下测试VM，然后选择<strong>确认</strong>或<strong>回滚</strong></p>
            </div>
          }
          style={{ marginTop: 16 }}
        />
      </Modal>

      {/* 镜像上传模态框 */}
      <Modal
        title="上传镜像"
        open={imageUploadModalVisible}
        onOk={handleUploadImage}
        onCancel={() => {
          setImageUploadModalVisible(false);
          imageForm.resetFields();
        }}
        okText="上传"
        cancelText="取消"
      >
        <Form form={imageForm} layout="vertical">
          <Form.Item
            label="镜像名称"
            name="name"
            rules={[{ required: true, message: '请输入镜像名称' }]}
          >
            <Input placeholder="例如: ubuntu-22.04" />
          </Form.Item>
          <Form.Item
            label="磁盘格式"
            name="disk_format"
            initialValue="qcow2"
          >
            <Select>
              <Select.Option value="qcow2">QCOW2</Select.Option>
              <Select.Option value="raw">RAW</Select.Option>
              <Select.Option value="iso">ISO</Select.Option>
              <Select.Option value="vmdk">VMDK</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="最小磁盘(GB)"
            name="min_disk"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="最小内存(MB)"
            name="min_ram"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="镜像文件"
            name="file"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e;
              }
              return e && e.fileList;
            }}
          >
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              accept=".qcow2,.raw,.iso,.img"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* 镜像编辑模态框 */}
      <Modal
        title="编辑镜像"
        open={imageEditModalVisible}
        onOk={handleEditImage}
        onCancel={() => {
          setImageEditModalVisible(false);
          imageForm.resetFields();
          setSelectedImage(null);
        }}
        okText="保存"
        cancelText="取消"
      >
        {selectedImage && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>镜像ID：</strong>{selectedImage.id}</p>
            <Divider />
          </div>
        )}
        <Form form={imageForm} layout="vertical">
          <Form.Item
            label="镜像名称"
            name="name"
            rules={[{ required: true, message: '请输入镜像名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="最小磁盘(GB)"
            name="min_disk"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="最小内存(MB)"
            name="min_ram"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配浮动IP模态框 */}
      <Modal
        title="分配浮动IP"
        open={allocateIPModalVisible}
        onCancel={() => {
          setAllocateIPModalVisible(false);
          allocateIPForm.resetFields();
        }}
        onOk={() => allocateIPForm.submit()}
      >
        <Form
          form={allocateIPForm}
          layout="vertical"
          onFinish={handleAllocateIP}
        >
          <Form.Item
            label="外部网络ID"
            name="network_id"
            rules={[{ required: true, message: '请输入外部网络ID' }]}
          >
            <Select placeholder="选择外部网络">
              {networks.filter(net => net.network_type === 'external').map(net => (
                <Select.Option key={net.id} value={net.id}>{net.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 绑定浮动IP模态框 */}
      <Modal
        title="绑定浮动IP"
        open={associateIPModalVisible}
        onCancel={() => {
          setAssociateIPModalVisible(false);
          associateIPForm.resetFields();
        }}
        onOk={() => associateIPForm.submit()}
      >
        <Form
          form={associateIPForm}
          layout="vertical"
          onFinish={handleAssociateIP}
        >
          <Form.Item label="浮动IP地址">
            <Input value={selectedFloatingIP?.floating_ip_address} disabled />
          </Form.Item>
          <Form.Item
            label="选择服务器"
            name="server_id"
            rules={[{ required: true, message: '请选择要绑定的服务器' }]}
          >
            <Select placeholder="选择虚拟机">
              {servers.map(server => (
                <Select.Option key={server.id} value={server.id}>
                  {server.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建安全组模态框 */}
      <Modal
        title="创建安全组"
        open={createSGModalVisible}
        onCancel={() => {
          setCreateSGModalVisible(false);
          createSGForm.resetFields();
        }}
        onOk={() => createSGForm.submit()}
      >
        <Form
          form={createSGForm}
          layout="vertical"
          onFinish={handleCreateSG}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入安全组名称' }]}
          >
            <Input placeholder="例如：web-server-sg" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea placeholder="安全组描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 安全组规则管理模态框 */}
      <Modal
        title={`规则管理 - ${selectedSG?.name}`}
        open={manageRulesModalVisible}
        onCancel={() => setManageRulesModalVisible(false)}
        width={800}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Form
            form={addRuleForm}
            layout="inline"
            onFinish={handleAddRule}
          >
            <Form.Item name="direction" initialValue="ingress" style={{ width: 100 }}>
              <Select>
                <Select.Option value="ingress">入站</Select.Option>
                <Select.Option value="egress">出站</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="protocol" initialValue="tcp" style={{ width: 100 }}>
              <Select>
                <Select.Option value="tcp">TCP</Select.Option>
                <Select.Option value="udp">UDP</Select.Option>
                <Select.Option value="icmp">ICMP</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="port_range_min" style={{ width: 100 }}>
              <InputNumber placeholder="起始端口" min={1} max={65535} />
            </Form.Item>
            <Form.Item name="port_range_max" style={{ width: 100 }}>
              <InputNumber placeholder="结束端口" min={1} max={65535} />
            </Form.Item>
            <Form.Item name="remote_ip_prefix" style={{ width: 150 }}>
              <Input placeholder="CIDR (例如 0.0.0.0/0)" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">添加规则</Button>
            </Form.Item>
          </Form>
        </div>
        <Table
          dataSource={selectedSG?.security_group_rules || []}
          rowKey="id"
          size="small"
          columns={[
            { title: '方向', dataIndex: 'direction', render: d => d === 'ingress' ? '入站' : '出站', width: 80 },
            { title: '协议', dataIndex: 'protocol', width: 80 },
            {
              title: '端口范围',
              render: (_, r) => r.port_range_min === r.port_range_max ? r.port_range_min : `${r.port_range_min}-${r.port_range_max}`,
              width: 120
            },
            { title: '远端IP', dataIndex: 'remote_ip_prefix', width: 150 },
            {
              title: '操作',
              render: (_, record) => (
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => handleDeleteRule(record.id)}
                >
                  删除
                </Button>
              )
            }
          ]}
        />
      </Modal>

      {/* 告警规则创建/编辑模态框 */}
      <Modal
        title="创建告警规则"
        open={alertRuleModalVisible}
        onCancel={() => {
          setAlertRuleModalVisible(false);
          alertRuleForm.resetFields();
        }}
        onOk={() => alertRuleForm.submit()}
      >
        <Form
          form={alertRuleForm}
          layout="vertical"
          onFinish={handleCreateAlertRule}
        >
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如: CPU高负载告警" />
          </Form.Item>
          <Form.Item
            label="监控指标"
            name="metric_type"
            rules={[{ required: true, message: '请选择监控指标' }]}
          >
            <Select placeholder="选择指标">
              <Select.Option value="cpu">CPU使用率</Select.Option>
              <Select.Option value="memory">内存使用率</Select.Option>
              <Select.Option value="disk">磁盘使用率</Select.Option>
              <Select.Option value="network_in">网络入流量</Select.Option>
              <Select.Option value="network_out">网络出流量</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="比较操作符"
            name="operator"
            initialValue="gt"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="gt">大于 (&gt;)</Select.Option>
              <Select.Option value="lt">小于 (&lt;)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="阈值(%)"
            name="threshold"
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="例如: 80" />
          </Form.Item>
          <Form.Item
            label="持续时间(分钟)"
            name="duration"
            initialValue={5}
            rules={[{ required: true, message: '请输入持续时间' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="关联虚拟机(可选)"
            name="virtual_machine"
            help="不选则为全局规则，对所有虚拟机生效"
          >
            <Select
              showSearch
              allowClear
              placeholder="选择虚拟机"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {vmOverview?.virtual_machines?.map(vm => (
                <Select.Option key={vm.id} value={vm.id}>{vm.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="启用规则"
            name="enabled"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div >
  );
};

export default CloudResources;
