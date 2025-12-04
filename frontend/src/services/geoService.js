/**
 * IP地理定位服务
 * 使用 ip-api.com 免费API进行IP地理位置查询
 */

const IPAPI_ENDPOINT = 'http://ip-api.com/json/';
const CACHE_KEY = 'ip_location_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

/**
 * 从缓存获取IP位置
 */
const getCachedLocation = (ip) => {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const cached = cache[ip];
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
            return cached.data;
        }
    } catch (error) {
        console.error('读取缓存失败:', error);
    }
    return null;
};

/**
 * 缓存IP位置
 */
const cacheLocation = (ip, data) => {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cache[ip] = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('缓存失败:', error);
    }
};

/**
 * 获取单个IP的地理位置
 */
export const getIPLocation = async (ip) => {
    // 检查缓存
    const cached = getCachedLocation(ip);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(`${IPAPI_ENDPOINT}${ip}`);
        const data = await response.json();

        if (data.status === 'success') {
            const location = {
                lat: data.lat,
                lon: data.lon,
                city: data.city,
                country: data.country,
                region: data.regionName,
                countryCode: data.countryCode
            };

            // 缓存结果
            cacheLocation(ip, location);
            return location;
        }

        return null;
    } catch (error) {
        console.error('IP定位失败:', error);
        return null;
    }
};

/**
 * 批量获取IP地理位置（带限流）
 */
export const batchGetIPLocations = async (ips, onProgress) => {
    const results = [];
    const total = ips.length;

    for (let i = 0; i < ips.length; i++) {
        const ip = ips[i];
        const location = await getIPLocation(ip);

        if (location) {
            results.push({ ip, ...location });
        }

        // 更新进度
        if (onProgress) {
            onProgress(i + 1, total);
        }

        // 防止API限流，每次请求间隔150ms
        if (i < ips.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    return results;
};

/**
 * 清除缓存
 */
export const clearLocationCache = () => {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (error) {
        console.error('清除缓存失败:', error);
    }
};

export default {
    getIPLocation,
    batchGetIPLocations,
    clearLocationCache
};
