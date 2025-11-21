import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * 系统配置Context
 * 全局共享系统设置（系统名称等）
 */
const SystemConfigContext = createContext();

export const SystemConfigProvider = ({ children }) => {
    const [systemConfig, setSystemConfig] = useState({
        systemName: '云平台管理系统',
        systemVersion: '1.0.0',
        loading: true
    });

    // 加载系统配置
    useEffect(() => {
        fetchSystemConfig();
    }, []);

    const fetchSystemConfig = async () => {
        try {
            const response = await fetch('/api/system/settings/category/?name=system', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSystemConfig({
                    ...data.settings,
                    loading: false
                });
            } else {
                // 如果获取失败，使用默认值
                setSystemConfig(prev => ({ ...prev, loading: false }));
            }
        } catch (error) {
            console.error('Failed to load system config:', error);
            setSystemConfig(prev => ({ ...prev, loading: false }));
        }
    };

    const updateSystemConfig = (newConfig) => {
        setSystemConfig(prev => ({ ...prev, ...newConfig }));
    };

    return (
        <SystemConfigContext.Provider value={{ systemConfig, updateSystemConfig, refreshConfig: fetchSystemConfig }}>
            {children}
        </SystemConfigContext.Provider>
    );
};

export const useSystemConfig = () => {
    const context = useContext(SystemConfigContext);
    if (!context) {
        throw new Error('useSystemConfig must be used within SystemConfigProvider');
    }
    return context;
};

export default SystemConfigContext;
