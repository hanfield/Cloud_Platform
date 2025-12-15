import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import cloudService from '../services/cloudService';
import api from '../services/api';

// 缓存配置
const CACHE_TTL = {
    flavors: 30 * 60 * 1000, // 30分钟
    images: 10 * 60 * 1000,  // 10分钟
    networks: 10 * 60 * 1000 // 10分钟
};

// 创建 Context
const ResourceCacheContext = createContext(null);

// Cache entry 结构
const createCacheEntry = (data) => ({
    data,
    timestamp: Date.now()
});

// 检查缓存是否过期
const isCacheExpired = (entry, ttl) => {
    if (!entry) return true;
    return Date.now() - entry.timestamp > ttl;
};

export const ResourceCacheProvider = ({ children }) => {
    const [flavorsCache, setFlavorsCache] = useState(null);
    const [imagesCache, setImagesCache] = useState(null);
    const [networksCache, setNetworksCache] = useState(null);

    // 获取 Flavors（带缓存）
    const getFlavors = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && flavorsCache && !isCacheExpired(flavorsCache, CACHE_TTL.flavors)) {
            console.log('[Cache] Using cached flavors');
            return flavorsCache.data;
        }

        console.log('[Cache] Fetching fresh flavors');
        try {
            const data = await cloudService.getFlavors();
            setFlavorsCache(createCacheEntry(data));
            return data;
        } catch (error) {
            console.error('[Cache] Failed to fetch flavors:', error);
            // 如果有过期缓存，降级使用
            if (flavorsCache) {
                console.warn('[Cache] Using expired cache due to fetch error');
                return flavorsCache.data;
            }
            throw error;
        }
    }, [flavorsCache]);

    // 获取 Images（带缓存）
    const getImages = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && imagesCache && !isCacheExpired(imagesCache, CACHE_TTL.images)) {
            console.log('[Cache] Using cached images');
            return imagesCache.data;
        }

        console.log('[Cache] Fetching fresh images');
        try {
            const data = await cloudService.getImages();
            setImagesCache(createCacheEntry(data));
            return data;
        } catch (error) {
            console.error('[Cache] Failed to fetch images:', error);
            if (imagesCache) {
                console.warn('[Cache] Using expired cache due to fetch error');
                return imagesCache.data;
            }
            throw error;
        }
    }, [imagesCache]);

    // 获取 Networks（带缓存）
    const getNetworks = useCallback(async (forceRefresh = false, params = {}) => {
        if (!forceRefresh && networksCache && !isCacheExpired(networksCache, CACHE_TTL.networks)) {
            console.log('[Cache] Using cached networks');
            return networksCache.data;
        }

        console.log('[Cache] Fetching fresh networks');
        try {
            const data = await api.get('/openstack/networks/', { params: { detailed: true, ...params } });
            setNetworksCache(createCacheEntry(data));
            return data;
        } catch (error) {
            console.error('[Cache] Failed to fetch networks:', error);
            if (networksCache) {
                console.warn('[Cache] Using expired cache due to fetch error');
                return networksCache.data;
            }
            throw error;
        }
    }, [networksCache]);

    // 清除所有缓存
    const clearAllCache = useCallback(() => {
        console.log('[Cache] Clearing all cache');
        setFlavorsCache(null);
        setImagesCache(null);
        setNetworksCache(null);
    }, []);

    // 清除特定缓存
    const clearCache = useCallback((type) => {
        console.log(`[Cache] Clearing ${type} cache`);
        switch (type) {
            case 'flavors':
                setFlavorsCache(null);
                break;
            case 'images':
                setImagesCache(null);
                break;
            case 'networks':
                setNetworksCache(null);
                break;
            default:
                break;
        }
    }, []);

    const value = {
        getFlavors,
        getImages,
        getNetworks,
        clearAllCache,
        clearCache,
        // 暴露缓存状态供调试
        cacheStatus: {
            flavors: flavorsCache ? {
                cached: true,
                age: Date.now() - flavorsCache.timestamp,
                expired: isCacheExpired(flavorsCache, CACHE_TTL.flavors)
            } : { cached: false },
            images: imagesCache ? {
                cached: true,
                age: Date.now() - imagesCache.timestamp,
                expired: isCacheExpired(imagesCache, CACHE_TTL.images)
            } : { cached: false },
            networks: networksCache ? {
                cached: true,
                age: Date.now() - networksCache.timestamp,
                expired: isCacheExpired(networksCache, CACHE_TTL.networks)
            } : { cached: false }
        }
    };

    return (
        <ResourceCacheContext.Provider value={value}>
            {children}
        </ResourceCacheContext.Provider>
    );
};

// 自定义 hooks
export const useResourceCache = () => {
    const context = useContext(ResourceCacheContext);
    if (!context) {
        throw new Error('useResourceCache must be used within ResourceCacheProvider');
    }
    return context;
};

export const useFlavors = () => {
    const { getFlavors } = useResourceCache();
    const [flavors, setFlavors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getFlavors(forceRefresh);
            setFlavors(data || []);
        } catch (err) {
            setError(err);
            setFlavors([]);
        } finally {
            setLoading(false);
        }
    }, [getFlavors]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { flavors, loading, error, refresh };
};

export const useImages = () => {
    const { getImages } = useResourceCache();
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getImages(forceRefresh);
            setImages(data || []);
        } catch (err) {
            setError(err);
            setImages([]);
        } finally {
            setLoading(false);
        }
    }, [getImages]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { images, loading, error, refresh };
};

export const useNetworks = (params = {}) => {
    const { getNetworks } = useResourceCache();
    const [networks, setNetworks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const refresh = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const data = await getNetworks(forceRefresh, params);
            setNetworks(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err);
            setNetworks([]);
        } finally {
            setLoading(false);
        }
    }, [getNetworks, params]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { networks, loading, error, refresh };
};

export default ResourceCacheContext;
