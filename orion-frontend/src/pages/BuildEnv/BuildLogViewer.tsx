/**
 * Build Log Viewer
 * SSE streaming log viewer with pause/resume, search filter, and auto-scroll.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Typography, Button, Input, Space, Card } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons';
import { getBuildLogStreamUrl } from '@/api/build-env';

const { Text } = Typography;

interface BuildLogViewerProps {
  logId: string;
  /** Optional height for the log container (default: 500) */
  height?: number;
  /** Whether to auto-connect on mount (default: true) */
  autoStart?: boolean;
}

const BuildLogViewer: React.FC<BuildLogViewerProps> = ({ logId, height = 500, autoStart = true }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pausedRef = useRef(false);

  // Keep pausedRef in sync
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = getBuildLogStreamUrl(logId);
    const fullUrl = `${window.location.origin}${url}`;

    const es = new EventSource(fullUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      if (pausedRef.current) return;
      setLines((prev) => {
        const newLines = [...prev, ...event.data.split('\n')];
        // Keep max 10000 lines to avoid memory issues
        return newLines.length > 10000 ? newLines.slice(-10000) : newLines;
      });
    };

    es.onerror = () => {
      setConnected(false);
      // Only set error if we never received data
      setLines((prev) => {
        if (prev.length === 0) {
          setError('Failed to connect to log stream');
        }
        return prev;
      });
      es.close();
    };

    // Handle completion signal
    es.addEventListener('complete', () => {
      setConnected(false);
      es.close();
    });
  }, [logId]);

  useEffect(() => {
    if (autoStart) {
      connect();
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [logId, autoStart, connect]);

  // Auto-scroll when new lines arrive and not paused
  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, paused]);

  const handleTogglePause = () => {
    setPaused((prev) => !prev);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredLines = searchTerm
    ? lines.filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
    : lines;

  const handleClear = () => {
    setLines([]);
  };

  const handleReconnect = () => {
    setLines([]);
    setError(null);
    setPaused(false);
    connect();
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <Text code>Log: {logId}</Text>
          {connected && (
            <Text type="success" style={{ fontSize: 12 }}>Streaming</Text>
          )}
          {paused && (
            <Text type="warning" style={{ fontSize: 12 }}>Paused</Text>
          )}
        </Space>
      }
      extra={
        <Space size="small">
          <Input
            placeholder="Filter logs..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={handleSearchChange}
            allowClear
            style={{ width: 200 }}
            size="small"
          />
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={handleClear}
            title="Clear logs"
          />
          <Button
            type="text"
            size="small"
            icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            onClick={handleTogglePause}
            title={paused ? 'Resume' : 'Pause'}
          />
          {error && (
            <Button type="link" size="small" onClick={handleReconnect}>
              Reconnect
            </Button>
          )}
        </Space>
      }
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 0 } }}
    >
      {error && (
        <div style={{ padding: '12px 16px' }}>
          <Text type="danger">{error}</Text>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          height,
          overflowY: 'auto',
          background: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace',
          fontSize: 13,
          lineHeight: '20px',
          padding: '12px 16px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {filteredLines.length === 0 && !error ? (
          <Text style={{ color: '#6a6a6a' }}>Waiting for logs...</Text>
        ) : (
          filteredLines.map((line, index) => {
            // Highlight search term
            if (searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())) {
              const lowerLine = line.toLowerCase();
              const lowerSearch = searchTerm.toLowerCase();
              const parts: React.ReactNode[] = [];
              let lastIndex = 0;
              let idx = lowerLine.indexOf(lowerSearch, lastIndex);
              while (idx !== -1) {
                if (idx > lastIndex) {
                  parts.push(line.slice(lastIndex, idx));
                }
                parts.push(
                  <span key={`${index}-${idx}`} style={{ background: '#613a00', color: '#ffda66' }}>
                    {line.slice(idx, idx + searchTerm.length)}
                  </span>
                );
                lastIndex = idx + searchTerm.length;
                idx = lowerLine.indexOf(lowerSearch, lastIndex);
              }
              if (lastIndex < line.length) {
                parts.push(line.slice(lastIndex));
              }
              return (
                <div key={index} style={{ minHeight: 20 }}>
                  <span style={{ color: '#858585', userSelect: 'none', marginRight: 8, display: 'inline-block', width: 40, textAlign: 'right' }}>
                    {index + 1}
                  </span>
                  {parts}
                </div>
              );
            }
            return (
              <div key={index} style={{ minHeight: 20 }}>
                <span style={{ color: '#858585', userSelect: 'none', marginRight: 8, display: 'inline-block', width: 40, textAlign: 'right' }}>
                  {index + 1}
                </span>
                {line}
              </div>
            );
          })
        )}
      </div>
      <div
        style={{
          padding: '6px 16px',
          background: '#2d2d2d',
          borderTop: '1px solid #3c3c3c',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#858585', fontSize: 11 }}>
          {filteredLines.length} lines
          {searchTerm && ` (filtered from ${lines.length})`}
        </Text>
        <Text style={{ color: '#858585', fontSize: 11 }}>
          {paused ? 'Paused' : connected ? 'Live' : 'Disconnected'}
        </Text>
      </div>
    </Card>
  );
};

export default BuildLogViewer;
