import React, { useRef, useEffect, useState } from 'react';
import Globe from 'react-globe.gl';
import { Spin, Card, Space, Statistic, Tag } from 'antd';
import { GlobalOutlined, EnvironmentOutlined } from '@ant-design/icons';

const VMGlobe3D = ({ vmData, loading }) => {
    const globeEl = useRef();
    const [points, setPoints] = useState([]);
    const [stats, setStats] = useState({ total: 0, running: 0, stopped: 0, countries: 0 });

    useEffect(() => {
        // 设置初始相机角度和自动旋转
        if (globeEl.current) {
            globeEl.current.pointOfView({ altitude: 2.5, lat: 20, lng: 100 });

            // 配置控制器
            const controls = globeEl.current.controls();
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.3; // 缓慢旋转
            controls.enableZoom = true;
            controls.minDistance = 200;
            controls.maxDistance = 600;
        }
    }, []);

    useEffect(() => {
        // 转换VM数据为地球点数据
        if (vmData && vmData.length > 0) {
            const mappedPoints = vmData
                .filter(vm => vm.latitude && vm.longitude) // 只显示有位置的VM
                .map(vm => ({
                    lat: vm.latitude,
                    lng: vm.longitude,
                    size: 0.4,
                    color: vm.status === 'running' ? '#00ff00' : vm.status === 'stopped' ? '#ff6600' : '#666666',
                    label: vm.name,
                    ip: vm.ip_address || vm.ip || 'N/A',
                    tenant: vm.tenant_name || '未知',
                    status: vm.status_display || vm.status,
                    city: vm.city || '',
                    country: vm.country || ''
                }));

            setPoints(mappedPoints);

            // 计算统计信息
            const countries = new Set(mappedPoints.map(p => p.country).filter(Boolean));
            setStats({
                total: mappedPoints.length,
                running: mappedPoints.filter(p => p.color === '#00ff00').length,
                stopped: mappedPoints.filter(p => p.color === '#ff6600').length,
                countries: countries.size
            });
        } else {
            setPoints([]);
            setStats({ total: 0, running: 0, stopped: 0, countries: 0 });
        }
    }, [vmData]);

    if (loading) {
        return (
            <div style={{
                height: '700px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, #000814 0%, #001d3d 100%)'
            }}>
                <Space direction="vertical" align="center">
                    <Spin size="large" />
                    <div style={{ color: '#00ccff', marginTop: 16 }}>正在加载3D地球...</div>
                </Space>
            </div>
        );
    }

    return (
        <div>
            {/* 统计面板 */}
            <Card
                style={{
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #001d3d 0%, #000814 100%)',
                    border: '1px solid #0066ff'
                }}
                bodyStyle={{ padding: '16px 24px' }}
            >
                <Space size="large" wrap>
                    <Statistic
                        title={<span style={{ color: '#00ccff' }}>总虚拟机</span>}
                        value={stats.total}
                        prefix={<GlobalOutlined style={{ color: '#0066ff' }} />}
                        valueStyle={{ color: '#ffffff' }}
                    />
                    <Statistic
                        title={<span style={{ color: '#00ccff' }}>运行中</span>}
                        value={stats.running}
                        valueStyle={{ color: '#00ff00' }}
                    />
                    <Statistic
                        title={<span style={{ color: '#00ccff' }}>已停止</span>}
                        value={stats.stopped}
                        valueStyle={{ color: '#ff6600' }}
                    />
                    <Statistic
                        title={<span style={{ color: '#00ccff' }}>覆盖国家</span>}
                        value={stats.countries}
                        prefix={<EnvironmentOutlined style={{ color: '#0066ff' }} />}
                        valueStyle={{ color: '#ffffff' }}
                    />
                </Space>
            </Card>

            {/* 3D地球 */}
            <div style={{
                height: '700px',
                background: 'linear-gradient(180deg, #000814 0%, #001d3d 100%)',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #0066ff',
                position: 'relative'
            }}>
                {points.length === 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: '#00ccff',
                        fontSize: '16px',
                        zIndex: 10,
                        textAlign: 'center'
                    }}>
                        <EnvironmentOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                        暂无虚拟机地理位置数据
                    </div>
                )}

                <Globe
                    ref={globeEl}

                    // 地球纹理 - 使用蓝色大理石纹理
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                    bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                    backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

                    // 点数据 - 虚拟机位置
                    pointsData={points}
                    pointAltitude="size"
                    pointColor="color"
                    pointRadius={0.5}
                    pointLabel={d => `
            <div style="
              background: rgba(0, 20, 40, 0.95); 
              padding: 12px 16px; 
              border-radius: 8px; 
              color: #00ccff; 
              border: 2px solid #0066ff;
              box-shadow: 0 0 20px rgba(0, 102, 255, 0.5);
              font-family: 'Segoe UI', sans-serif;
              min-width: 200px;
            ">
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #00ff00;">
                ${d.label}
              </div>
              <div style="font-size: 13px; line-height: 1.6;">
                <div><strong>IP地址:</strong> ${d.ip}</div>
                <div><strong>租户:</strong> ${d.tenant}</div>
                <div><strong>位置:</strong> ${d.city ? d.city + ', ' : ''}${d.country}</div>
                <div>
                  <strong>状态:</strong> 
                  <span style="color: ${d.color}; font-weight: bold;">
                    ${d.status}
                  </span>
                </div>
              </div>
            </div>
          `}

                    // 地球外观
                    atmosphereColor="#0066ff"
                    atmosphereAltitude={0.15}

                    // 交互控制
                    enablePointerInteraction={true}

                    // 渲染选项
                    width={undefined} // 自适应宽度
                    height={700}
                />

                {/* 图例 */}
                <div style={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    background: 'rgba(0, 20, 40, 0.9)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #0066ff',
                    color: '#00ccff',
                    fontSize: '12px'
                }}>
                    <div style={{ marginBottom: 8, fontWeight: 'bold' }}>图例</div>
                    <Space direction="vertical" size={4}>
                        <div>
                            <Tag color="#00ff00" style={{ marginRight: 8 }}>●</Tag>
                            运行中
                        </div>
                        <div>
                            <Tag color="#ff6600" style={{ marginRight: 8 }}>●</Tag>
                            已停止
                        </div>
                    </Space>
                </div>

                {/* 操作提示 */}
                <div style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    background: 'rgba(0, 20, 40, 0.9)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #0066ff',
                    color: '#00ccff',
                    fontSize: '12px'
                }}>
                    <div style={{ marginBottom: 4 }}>🖱️ 拖动旋转地球</div>
                    <div style={{ marginBottom: 4 }}>🔍 滚轮缩放</div>
                    <div>👆 悬停查看详情</div>
                </div>
            </div>
        </div>
    );
};

export default VMGlobe3D;
