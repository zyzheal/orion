/**
 * SmartRecommend Panel
 * Real-time AI-powered recommendations with SSE updates
 *
 * Features:
 * - Real-time recommendations via SSE (Server-Sent Events)
 * - Recommendation cards with severity badges and action buttons
 * - Connection status indicator with reconnect indicator
 * - Manual fetch fallback when SSE unavailable
 * - Execute recommended commands directly
 * - Dismiss/archive recommendations
 *
 * Integrated with ChatOps backend:
 * - POST /v1/chatops/recommendations (initial fetch)
 * - GET /api/v1/chatops/stream/recommendations (SSE stream)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Typography,
  Card,
  Tag,
  Button,
  Space,
  List,
  Badge,
  Empty,
  Alert,
  Spin,
  message,
  Drawer,
} from 'antd';
import {
  BulbOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  DisconnectOutlined,
  PlayCircleOutlined,
  CloseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  fetchRecommendations,
  executeCommand,
  connectSSE,
  disconnectSSE,
  type Recommendation,
  type CommandExecutionInput,
} from '@/api/chatops';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Type Extensions
// ============================================================================

interface RecommendationWithDismissed extends Recommendation {
  dismissed?: boolean;
}

// ============================================================================
// Severity Config
// ============================================================================

const severityConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  critical: { color: colors.error[500], icon: <WarningOutlined />, label: 'Critical' },
  warning: { color: colors.warning[500], icon: <WarningOutlined />, label: 'Warning' },
  info: { color: colors.info[500], icon: <InfoCircleOutlined />, label: 'Info' },
};

const sourceLabels: Record<string, string> = {
  alert: '告警系统',
  pipeline: '流水线',
  self_healing: '自愈系统',
  cost: '成本监控',
  deployment: '部署系统',
  security: '安全扫描',
};

// ============================================================================
// Recommendation Card Component
// ============================================================================

interface RecommendationCardProps {
  recommendation: RecommendationWithDismissed;
  onExecute: (command: string, params: Record<string, unknown>) => Promise<void>;
  onDismiss: (id: string) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onExecute,
  onDismiss,
}) => {
  const { severity, title, description, actions, createdAt, source } = recommendation;
  const config = severityConfig[severity] || severityConfig.info;
  const [executing, setExecuting] = useState<string | null>(null);

  const handleExecute = async (action: Recommendation['actions'][number]) => {
    setExecuting(action.command);
    try {
      await onExecute(action.command, action.params);
      message.success(`Command "${action.label}" executed`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Execution failed: ${error.message}`);
      } else {
        message.error('Execution failed');
      }
    } finally {
      setExecuting(null);
    }
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: spacing[2],
        borderLeft: `4px solid ${config.color}`,
        opacity: recommendation.dismissed ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space style={{ flex: 1 }}>
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
          <Tag color="geekblue">{sourceLabels[source] || source}</Tag>
          <Text strong>{title}</Text>
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(createdAt).fromNow()}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => onDismiss(recommendation.id)}
            disabled={recommendation.dismissed}
          />
        </Space>
      </div>

      <Paragraph type="secondary" style={{ marginTop: spacing[2], marginBottom: spacing[2] }}>
        {description}
      </Paragraph>

      {!recommendation.dismissed && actions.length > 0 && (
        <div style={{ display: 'flex', gap: spacing[2], flexWrap: 'wrap' }}>
          {actions.map((action, idx) => (
            <Button
              key={idx}
              size="small"
              type="primary"
              ghost
              icon={<PlayCircleOutlined />}
              loading={executing === action.command}
              onClick={() => handleExecute(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
};

// ============================================================================
// Connection Status Component
// ============================================================================

interface ConnectionStatusProps {
  connected: boolean;
  onReconnect: () => void;
  reconnecting: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connected,
  onReconnect,
  reconnecting,
}) => (
  <Space size="small">
    {connected ? (
      <Tag color="green" icon={<ThunderboltOutlined />}>
        Real-time Connected
      </Tag>
    ) : reconnecting ? (
      <Tag color="orange" icon={<SyncOutlined spin />}>
        Reconnecting...
      </Tag>
    ) : (
      <Space>
        <Tag color="default" icon={<DisconnectOutlined />}>
          Disconnected
        </Tag>
        <Button size="small" icon={<SyncOutlined />} onClick={onReconnect}>
          Reconnect
        </Button>
      </Space>
    )}
  </Space>
);

// ============================================================================
// Main SmartRecommend Component
// ============================================================================

const SmartRecommend: React.FC = () => {
  const [recommendations, setRecommendations] = useState<RecommendationWithDismissed[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionDrawerOpen, setExecutionDrawerOpen] = useState(false);
  const [executionLog, setExecutionLog] = useState<Array<{ time: string; command: string; status: string }>>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRecommendations({ currentPage: 'chatops' });
      const resData = res.data as { data?: Recommendation[] };
      const items = Array.isArray(resData?.data) ? resData.data : [];
      // Re-apply dismissed state
      setRecommendations(
        items.map((r: Recommendation) => ({
          ...r,
          dismissed: dismissedRef.current.has(r.id),
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // SSE Connection
  // ============================================================================

  const setupSSE = useCallback(() => {
    setReconnecting(true);
    connectSSE({
      onMessage: (data) => {
        setConnected(true);
        setReconnecting(false);
        setError(null);

        // Handle recommendations event - type guard for SSE data
        type SSEData = { type?: string; payload?: Recommendation | Recommendation[] };
        const sseData = data as SSEData;
        if (sseData?.type === 'recommendations' && sseData?.payload) {
          const newRecs = Array.isArray(sseData.payload) ? sseData.payload : [sseData.payload];
          setRecommendations((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const fresh = newRecs
              .filter((r: Recommendation) => !existingIds.has(r.id))
              .map((r: Recommendation) => ({
                ...r,
                dismissed: dismissedRef.current.has(r.id),
              }));
            // Prepend new recommendations, limit to 50
            return [...fresh, ...prev].slice(0, 50);
          });
        }
      },
      onReconnect: (_attempt) => {
        setReconnecting(true);
        setConnected(false);
      },
      onError: (err) => {
        setError(err.message);
        setConnected(false);
        setReconnecting(false);
      },
    });
  }, []);

  const handleReconnect = useCallback(() => {
    disconnectSSE();
    setupSSE();
  }, [setupSSE]);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    loadRecommendations();
    setupSSE();

    return () => {
      disconnectSSE();
    };
  }, [loadRecommendations, setupSSE]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleDismiss = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, dismissed: true } : r))
    );
  }, []);

  const handleExecute = useCallback(
    async (command: string, params: Record<string, unknown>) => {
      const input: CommandExecutionInput = {
        command,
        params,
      };
      try {
        await executeCommand(input);
        setExecutionLog((prev) => [
          { time: new Date().toLocaleTimeString(), command, status: 'success' },
          ...prev,
        ]);
      } catch {
        setExecutionLog((prev) => [
          { time: new Date().toLocaleTimeString(), command, status: 'failed' },
          ...prev,
        ]);
        throw new Error('Command execution failed');
      }
    },
    []
  );

  // ============================================================================
  // Stats
  // ============================================================================

  const activeCount = recommendations.filter((r) => !r.dismissed).length;
  const criticalCount = recommendations.filter(
    (r) => r.severity === 'critical' && !r.dismissed
  ).length;
  const dismissedCount = recommendations.filter((r) => r.dismissed).length;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing[4],
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <BulbOutlined style={{ marginRight: spacing[2], color: colors.warning[500] }} />
            Smart Recommendations
          </Title>
          <Text type="secondary">
            AI-powered insights with real-time updates via SSE
          </Text>
        </div>
        <Space>
          <ConnectionStatus
            connected={connected}
            onReconnect={handleReconnect}
            reconnecting={reconnecting}
          />
          <Button icon={<SyncOutlined />} onClick={loadRecommendations} loading={loading}>
            Refresh
          </Button>
          <Button
            icon={<ClockCircleOutlined />}
            onClick={() => setExecutionDrawerOpen(true)}
          >
            Execution Log ({executionLog.length})
          </Button>
        </Space>
      </div>

      {/* Stats Bar */}
      <Space style={{ marginBottom: spacing[4] }}>
        <Badge count={activeCount} style={{ backgroundColor: colors.primary[500] }}>
          <Tag>Active</Tag>
        </Badge>
        {criticalCount > 0 && (
          <Badge count={criticalCount} style={{ backgroundColor: colors.error[500] }}>
            <Tag color="red">Critical</Tag>
          </Badge>
        )}
        {dismissedCount > 0 && (
          <Badge count={dismissedCount} style={{ backgroundColor: colors.light.text.tertiary }}>
            <Tag>Dismissed</Tag>
          </Badge>
        )}
      </Space>

      {/* Error Alert */}
      {error && (
        <Alert
          message="Connection Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: spacing[3] }}
          action={
            <Button size="small" onClick={handleReconnect}>
              Retry
            </Button>
          }
        />
      )}

      {/* Recommendations List */}
      <Spin spinning={loading && recommendations.length === 0}>
        {recommendations.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No recommendations available"
          >
            <Button type="primary" onClick={loadRecommendations}>
              Refresh
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={recommendations}
            renderItem={(rec) => (
              <List.Item>
                <RecommendationCard
                  recommendation={rec}
                  onExecute={handleExecute}
                  onDismiss={handleDismiss}
                />
              </List.Item>
            )}
          />
        )}
      </Spin>

      {/* Execution Log Drawer */}
      <Drawer
        title="Execution Log"
        placement="right"
        width={400}
        open={executionDrawerOpen}
        onClose={() => setExecutionDrawerOpen(false)}
      >
        {executionLog.length === 0 ? (
          <Empty description="No executions yet" />
        ) : (
          <List
            dataSource={executionLog}
            renderItem={(log) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text code>{log.command}</Text>
                      <Tag color={log.status === 'success' ? 'green' : 'red'}>
                        {log.status}
                      </Tag>
                    </Space>
                  }
                  description={log.time}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
};

export default SmartRecommend;
