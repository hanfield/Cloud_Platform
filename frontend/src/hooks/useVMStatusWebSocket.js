import { useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';

/**
 * WebSocket hook for real-time VM status updates
 * @param {Function} onStatusUpdate - Callback when VM status changes
 * @returns {Object} WebSocket reference
 */
export const useVMStatusWebSocket = (onStatusUpdate) => {
    const ws = useRef(null);
    const reconnectTimeout = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(() => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                console.warn('No auth token, skipping WebSocket connection');
                return;
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/ws/vm-status/?token=${token}`;

            console.log('Connecting to WebSocket:', wsUrl);
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                console.log('✅ WebSocket connected');
                reconnectAttempts.current = 0;
                message.success('实时状态推送已连接', 2);
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message:', data);

                    if (data.type === 'vm_status_update') {
                        console.log('VM状态更新:', data.data);
                        onStatusUpdate(data.data);

                        // 显示状态变化通知
                        const { name, old_status, new_status } = data.data;
                        message.info(`${name}: ${old_status} → ${new_status}`, 3);
                    } else if (data.type === 'connection_established') {
                        console.log(data.message);
                    }
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.current.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);

                // Automatic reconnection
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1})`);

                    reconnectTimeout.current = setTimeout(() => {
                        reconnectAttempts.current += 1;
                        connect();
                    }, delay);
                } else {
                    message.warning('实时推送连接已断开', 3);
                }
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }, [onStatusUpdate]);

    const disconnect = useCallback(() => {
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
        }
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
    }, []);

    useEffect(() => {
        connect();

        // Heartbeat ping every 30 seconds
        const heartbeat = setInterval(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: 'ping',
                    timestamp: new Date().toISOString()
                }));
            }
        }, 30000);

        return () => {
            clearInterval(heartbeat);
            disconnect();
        };
    }, [connect, disconnect]);

    return ws;
};

export default useVMStatusWebSocket;
