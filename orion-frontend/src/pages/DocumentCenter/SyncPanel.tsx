/**
 * SyncPanel — 同步控制面板组件
 *
 * 触发文档同步（DocSyncEngine），展示同步进度与日志
 * 支持全量同步和增量同步
 */
import React, { useState, useEffect } from 'react';
import {
  Card, Button, Space, Progress, Tag, Typography, List, Modal, Spin, message,
  Tooltip, Badge,
} from 'antd';
import {
  SyncOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing, radius, shadows } from '@/tokens';
import { triggerDocSync, getSyncLogs, type SyncLog } from '@/api/knowledge';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

type SyncStatus = 'idle' | 'running' | 'success' | 'failed';

interface SyncPanelProps {
  visible: boolean;
  onClose: () => void;
}

// ============================================================================
// 同步状态配置
// ============================================================================

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  success: {
    icon: <CheckCircleOutlined />,
    color: colors.success[500],
    label: '成功',
  },
  failed: {
    icon: <CloseCircleOutlined />,
    color: colors.error[500],
    label: '失败',
  },
  skipped: {
    icon: <ExclamationCircleOutlined />,
    color: colors.warning[500],
    label: '跳过',
  },
};

// ============================================================================
// Component
// ============================================================================

export default function SyncPanel({ visible, onClose }: SyncPanelProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncType, setSyncType] = useState<'full' | 'incremental'>('incremental');
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      loadSyncLogs();
    }
  }, [visible]);

  const loadSyncLogs = async () => {
    setLogsLoading(true);
    try {
      const result = await getSyncLogs({ page: 1, pageSize: 20 });
      setLogs(result.data);
      if (result.data.length > 0) {
        setLastSyncTime(result.data[0].created_at);
      }
    } catch (error) {
      console.error('[SyncPanel] Failed to load sync logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncStatus('running');
    setSyncProgress(0);
    setSyncResult(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const result = await triggerDocSync(syncType);
      clearInterval(progressInterval);
      setSyncProgress(100);
      setSyncStatus('success');
      setSyncResult({
        total: result.totalFiles,
        success: result.successCount,
        failed: result.failedCount,
        skipped: result.skippedCount,
      });
      message.success(`同步完成：成功 ${result.successCount}，失败 ${result.failedCount}，跳过 ${result.skippedCount}`);

      // Reload logs
      await loadSyncLogs();
    } catch (error) {
      clearInterval(progressInterval);
      setSyncProgress(0);
      setSyncStatus('failed');
      message.error(`同步失败：${(error as Error).message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    const config = STATUS_CONFIG[status];
    if (!config) return <ClockCircleOutlined style={{ color: colors.neutral[400] }} />;
    return React.cloneElement(config.icon as React.ReactElement, {
      style: { color: config.color },
    });
  };

  return (
    <Modal
      title={
        <Space>
          <SyncOutlined spin={syncStatus === 'running'} />
          <span>文档同步</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      <Spin spinning={logsLoading}>
        <div style={{ paddingTop: spacing[2] }}>
          {/* 同步控制区 */}
          <Card
            size="small"
            style={{
              marginBottom: spacing[4],
              borderRadius: radius[3],
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong>同步控制</Text>
                {lastSyncTime && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      上次同步: {dayjs(lastSyncTime).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </div>
                )}
              </div>
              <Space>
                <Button
                  type={syncType === 'incremental' ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setSyncType('incremental')}
                  disabled={syncStatus === 'running'}
                >
                  增量同步
                </Button>
                <Button
                  type={syncType === 'full' ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setSyncType('full')}
                  disabled={syncStatus === 'running'}
                >
                  全量同步
                </Button>
                <Button
                  type="primary"
                  icon={<SyncOutlined spin={syncStatus === 'running'} />}
                  onClick={handleSync}
                  loading={syncStatus === 'running'}
                  disabled={syncStatus === 'running'}
                >
                  {syncStatus === 'running' ? '同步中...' : '开始同步'}
                </Button>
              </Space>
            </div>

            {/* 进度条 */}
            {syncStatus === 'running' && (
              <div style={{ marginTop: spacing[4] }}>
                <Progress
                  percent={Math.round(syncProgress)}
                  strokeColor={colors.primary[500]}
                  status="active"
                />
              </div>
            )}

            {/* 同步结果 */}
            {syncResult && syncStatus !== 'running' && (
              <div style={{ marginTop: spacing[4] }}>
                <Space size="large">
                  <Tooltip title="总数">
                    <Badge count={syncResult.total} style={{ backgroundColor: colors.neutral[400] }}>
                      <Text type="secondary">总计</Text>
                    </Badge>
                  </Tooltip>
                  <Tooltip title="成功">
                    <Badge count={syncResult.success} style={{ backgroundColor: colors.success[500] }}>
                      <Text type="secondary">成功</Text>
                    </Badge>
                  </Tooltip>
                  <Tooltip title="失败">
                    <Badge count={syncResult.failed} style={{ backgroundColor: colors.error[500] }}>
                      <Text type="secondary">失败</Text>
                    </Badge>
                  </Tooltip>
                  <Tooltip title="跳过">
                    <Badge count={syncResult.skipped} style={{ backgroundColor: colors.warning[500] }}>
                      <Text type="secondary">跳过</Text>
                    </Badge>
                  </Tooltip>
                </Space>
              </div>
            )}
          </Card>

          {/* 同步日志 */}
          <Card
            size="small"
            title={
              <Space>
                <HistoryOutlined />
                <span>同步日志</span>
              </Space>
            }
            style={{ borderRadius: radius[3], boxShadow: shadows.card }}
          >
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: spacing[6], color: colors.neutral[400] }}>
                <Text type="secondary">暂无同步记录</Text>
              </div>
            ) : (
              <List
                dataSource={logs}
                renderItem={(log) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getStatusIcon(log.status)}
                      title={
                        <Space>
                          <Text strong style={{ fontSize: 13 }}>{log.file_path || 'N/A'}</Text>
                          <Tag
                            color={STATUS_CONFIG[log.status]?.color || colors.neutral[400]}
                            style={{ fontSize: 10, padding: '0 4px' }}
                          >
                            {STATUS_CONFIG[log.status]?.label || log.status}
                          </Tag>
                          {log.sync_type && (
                            <Tag style={{ fontSize: 10, padding: '0 4px' }}>
                              {log.sync_type === 'full' ? '全量' : '增量'}
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Space size="large">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
                          </Text>
                          {log.error_message && (
                            <Text type="danger" style={{ fontSize: 12 }}>
                              {log.error_message}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>
      </Spin>
    </Modal>
  );
}
