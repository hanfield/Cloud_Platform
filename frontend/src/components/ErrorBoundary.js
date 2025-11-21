import React from 'react';
import { Result, Button } from 'antd';
import { handleComponentError } from '../utils/errorHandler';

/**
 * 错误边界组件
 * 捕获子组件树中的JavaScript错误并显示备用UI
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        // 更新state使下一次渲染能够显示错误UI
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error, errorInfo) {
        // 记录错误到错误追踪服务
        handleComponentError(error, errorInfo);

        this.setState({
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });

        // 如果提供了重置回调，执行它
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            // 自定义错误UI
            return (
                <div style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <Result
                        status="error"
                        title="页面出现错误"
                        subTitle={
                            process.env.NODE_ENV === 'development'
                                ? this.state.error?.message
                                : '抱歉，页面加载出现问题，请刷新重试'
                        }
                        extra={[
                            <Button type="primary" key="reset" onClick={this.handleReset}>
                                重新加载
                            </Button>,
                            <Button key="home" onClick={() => window.location.href = '/'}>
                                返回首页
                            </Button>
                        ]}
                    />

                    {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                        <details style={{
                            marginTop: 20,
                            textAlign: 'left',
                            whiteSpace: 'pre-wrap',
                            background: '#f5f5f5',
                            padding: 20,
                            borderRadius: 4
                        }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: 10 }}>
                                错误详情 (仅开发环境可见)
                            </summary>
                            <p><strong>错误:</strong> {this.state.error?.toString()}</p>
                            <p><strong>堆栈:</strong></p>
                            <p style={{ fontSize: 12, color: '#666' }}>
                                {this.state.errorInfo.componentStack}
                            </p>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
