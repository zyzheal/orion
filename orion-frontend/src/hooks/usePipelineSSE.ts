/**
 * usePipelineSSE Hook
 *
 * React Hook for Pipeline SSE real-time log streaming
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { message } from 'antd';

interface PipelineLogEvent {
  pipelineId: string;
  runId: string;
  stageId: string;
  stageName: string;
  stepName?: string;
  logLine: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  metadata?: Record<string, unknown>;
}

interface PipelineStatusEvent {
  pipelineId: string;
  runId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  stageId?: string;
  stageName?: string;
  progress: number;
  timestamp: Date;
}

interface UsePipelineSSEOptions {
  pipelineId: string;
  runId: string;
  logLevel?: ('info' | 'warn' | 'error' | 'debug')[];
  autoConnect?: boolean;
  maxLogs?: number; // Maximum logs to keep in buffer
  onError?: (error: Error) => void;
  onStatusChange?: (status: PipelineStatusEvent) => void;
  onLog?: (log: PipelineLogEvent) => void;
}

interface UsePipelineSSEReturn {
  logs: PipelineLogEvent[];
  status: PipelineStatusEvent | null;
  isConnected: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  clearLogs: () => void;
}

/**
 * React Hook for Pipeline SSE real-time streaming
 */
export function usePipelineSSE(options: UsePipelineSSEOptions): UsePipelineSSEReturn {
  const {
    pipelineId,
    runId,
    logLevel = ['info', 'warn', 'error'],
    autoConnect = true,
    maxLogs = 1000,
    onError,
    onStatusChange,
    onLog,
  } = options;

  const [logs, setLogs] = useState<PipelineLogEvent[]>([]);
  const [status, setStatus] = useState<PipelineStatusEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Build SSE URL
  const buildSSEUrl = useCallback(() => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
    const logLevelParam = logLevel.join(',');
    return `${baseUrl}/pipelines/sse/logs?pipelineId=${pipelineId}&runId=${runId}&logLevel=${logLevelParam}`;
  }, [pipelineId, runId, logLevel]);

  // Connect to SSE
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = buildSSEUrl();
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      console.log('[PipelineSSE] Connected to', url);
    };

    eventSource.onerror = (err) => {
      console.error('[PipelineSSE] Connection error:', err);
      setIsConnected(false);
      const newError = new Error('SSE connection failed');
      setError(newError);
      onError?.(newError);

      // Auto reconnect with exponential backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAY * (reconnectAttemptsRef.current + 1);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      } else {
        message.error('Pipeline 日志连接失败，请刷新页面重试');
      }
    };

    // Handle connected event
    eventSource.addEventListener('connected', (event: MessageEvent) => {
      console.log('[PipelineSSE] Server confirmed connection:', JSON.parse(event.data));
    });

    // Handle log events
    eventSource.addEventListener('log', (event: MessageEvent) => {
      try {
        const logData: PipelineLogEvent = JSON.parse(event.data);
        logData.timestamp = new Date(logData.timestamp);

        setLogs((prevLogs) => {
          // Keep max logs in buffer
          const newLogs = [...prevLogs, logData];
          if (newLogs.length > maxLogs) {
            return newLogs.slice(-maxLogs);
          }
          return newLogs;
        });

        onLog?.(logData);
      } catch (e) {
        console.error('[PipelineSSE] Failed to parse log event:', e);
      }
    });

    // Handle status events
    eventSource.addEventListener('status', (event: MessageEvent) => {
      try {
        const statusData: PipelineStatusEvent = JSON.parse(event.data);
        statusData.timestamp = new Date(statusData.timestamp);

        setStatus(statusData);
        onStatusChange?.(statusData);

        // Show notification for completion
        if (statusData.status === 'success') {
          message.success('Pipeline 执行成功');
        } else if (statusData.status === 'failed') {
          message.error('Pipeline 执行失败');
        }
      } catch (e) {
        console.error('[PipelineSSE] Failed to parse status event:', e);
      }
    });

    // Handle stage events
    eventSource.addEventListener('stage_start', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[PipelineSSE] Stage started:', data.stageName);
      } catch (e) {
        console.error('[PipelineSSE] Failed to parse stage_start:', e);
      }
    });

    eventSource.addEventListener('stage_end', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[PipelineSSE] Stage ended:', data.stageName, data.status);
      } catch (e) {
        console.error('[PipelineSSE] Failed to parse stage_end:', e);
      }
    });

    // Handle step events
    eventSource.addEventListener('step_start', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[PipelineSSE] Step started:', data.stepName);
      } catch (e) {
        console.error('[PipelineSSE] Failed to parse step_start:', e);
      }
    });

    eventSource.addEventListener('step_end', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[PipelineSSE] Step ended:', data.stepName);
      } catch (e) {
        console.error('[PipelineSSE] Failed to parse step_end:', e);
      }
    });

    return eventSource;
  }, [buildSSEUrl, maxLogs, onError, onStatusChange, onLog]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  // Clear logs buffer
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Auto connect on mount
  useEffect(() => {
    if (autoConnect && pipelineId && runId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, pipelineId, runId, connect, disconnect]);

  return {
    logs,
    status,
    isConnected,
    error,
    connect,
    disconnect,
    clearLogs,
  };
}

export default usePipelineSSE;