/**
 * 性能监控工具
 * 追踪API响应时间和组件性能
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = [];
        this.isEnabled = process.env.NODE_ENV === 'development';
    }

    /**
     * 开始测量
     * @param {string} name - 测量名称
     * @returns {number} - 开始时间戳
     */
    start(name) {
        if (!this.isEnabled) return null;
        return performance.now();
    }

    /**
     * 结束测量
     * @param {string} name - 测量名称
     * @param {number} startTime - 开始时间戳
     */
    end(name, startTime) {
        if (!this.isEnabled || !startTime) return;

        const duration = performance.now() - startTime;

        this.record({
            name,
            duration,
            timestamp: new Date().toISOString()
        });

        // 开发环境输出到控制台
        if (duration > 1000) {
            console.warn(`⚠️ Slow Operation: ${name} took ${duration.toFixed(2)}ms`);
        } else {
            console.log(`✓ ${name}: ${duration.toFixed(2)}ms`);
        }
    }

    /**
     * 记录指标
     * @param {object} metric - 指标对象
     */
    record(metric) {
        this.metrics.push(metric);

        // 保持最近100条记录
        if (this.metrics.length > 100) {
            this.metrics.shift();
        }
    }

    /**
     * 获取统计信息
     * @param {string} name - 操作名称（可选）
     * @returns {object} - 统计数据
     */
    getStatistics(name = null) {
        let filteredMetrics = this.metrics;

        if (name) {
            filteredMetrics = this.metrics.filter(m => m.name === name);
        }

        if (filteredMetrics.length === 0) {
            return null;
        }

        const durations = filteredMetrics.map(m => m.duration);
        const total = durations.reduce((sum, d) => sum + d, 0);
        const avg = total / durations.length;
        const min = Math.min(...durations);
        const max = Math.max(...durations);

        return {
            count: filteredMetrics.length,
            average: avg.toFixed(2),
            min: min.toFixed(2),
            max: max.toFixed(2),
            total: total.toFixed(2)
        };
    }

    /**
     * 清除所有记录
     */
    clear() {
        this.metrics = [];
    }

    /**
     * 获取所有记录
     */
    getAllMetrics() {
        return [...this.metrics];
    }
}

// 创建全局实例
const performanceMonitor = new PerformanceMonitor();

/**
 * API性能追踪装饰器
 * @param {Function} apiCall - API调用函数
 * @param {string} name - API名称
 */
export const trackApiPerformance = async (apiCall, name) => {
    const startTime = performanceMonitor.start(`API: ${name}`);

    try {
        const result = await apiCall();
        performanceMonitor.end(`API: ${name}`, startTime);
        return result;
    } catch (error) {
        performanceMonitor.end(`API: ${name} (Error)`, startTime);
        throw error;
    }
};

/**
 * React组件性能追踪Hook
 */
export const usePerformanceTracking = (componentName) => {
    if (!performanceMonitor.isEnabled) return;

    const startTime = React.useRef(performance.now());

    React.useEffect(() => {
        return () => {
            const duration = performance.now() - startTime.current;
            if (duration > 1000) {
                console.warn(`⚠️ Component ${componentName} was mounted for ${duration.toFixed(2)}ms`);
            }
        };
    }, [componentName]);
};

export default performanceMonitor;
export { PerformanceMonitor };
