/**
 * Build Pod Detail Page
 * Displays pod details and embeds the BuildLogViewer for streaming logs.
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Descriptions, Spin, message, Space } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, CloudServerOutlined,} from '@ant-design/icons';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import BuildLogViewer from './BuildLogViewer';
import { getBuildPod, getBuildPodLogs, cancelBuildPod, type BuildPod } from '@/api/build-env';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const BuildPodDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [pod, setPod] = useState<BuildPod | null>(null);
  const [logIds, setLogIds] = useState<string[]>([]);

  const loadPod = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await getBuildPod(id);
      const podData = response.data as BuildPod | null;
      setPod(podData);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载构建 Pod 详情失败：${error.message}`);
      } else {
        message.error('加载构建 Pod 详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!id) return;
    try {
      const response = await getBuildPodLogs(id);
      const logsData = response.data as Array<{ id?: string }> | null;
      const logs = Array.isArray(logsData) ? logsData : [];
      setLogIds(logs.map((log) => log.id || '').filter(Boolean));
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载 Pod 日志失败：${error.message}`);
      }
    }
  };

  useEffect(() => {
    loadPod();
    loadLogs();
  }, [id]);

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelBuildPod(id);
      message.success('Build pod cancelled');
      loadPod();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`取消构建 Pod 失败：${error.message}`);
      } else {
        message.error('取消构建 Pod 失败，请稍后重试');
      }
    }
  };

  if (!pod && !loading) {
    return (
      <div>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/console/build-env/pods')}
          style={{ marginBottom: spacing.md }}
        >
          Back to Pods
        </Button>
        <Text type="secondary">Build pod not found</Text>
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.lg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
            <Button
              type="link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/console/build-env/pods')}
            >
              Back
            </Button>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CloudServerOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
              {pod?.name || 'Build Pod'}
            </Title>
            {pod && <StatusBadge status={pod.status as StatusType} size="small" />}
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadPod();
                loadLogs();
              }}
              loading={loading}
            >
              Refresh
            </Button>
            {pod?.status === 'running' && (
              <Button danger onClick={handleCancel}>
                Cancel Build
              </Button>
            )}
          </Space>
        </div>

        {pod && (
          <Descriptions bordered column={2} style={{ marginBottom: spacing.lg }}>
            <Descriptions.Item label="Pod ID">{pod.id}</Descriptions.Item>
            <Descriptions.Item label="Namespace">{pod.namespace}</Descriptions.Item>
            <Descriptions.Item label="Run ID">{pod.runId}</Descriptions.Item>
            <Descriptions.Item label="Stage ID">{pod.stageId}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <StatusBadge status={pod.status as 'running' | 'success' | 'failed' | 'pending'} size="small" />
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {dayjs(pod.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Started">
              {pod.startedAt ? dayjs(pod.startedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Completed">
              {pod.completedAt ? dayjs(pod.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}

        <div style={{ marginTop: spacing.md }}>
          <Title level={4}>Build Logs</Title>
          {logIds.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              {logIds.map((logId) => (
                <BuildLogViewer key={logId} logId={logId} />
              ))}
            </Space>
          ) : (
            <Text type="secondary">No logs available for this pod</Text>
          )}
        </div>
      </div>
    </Spin>
  );
};

export default BuildPodDetail;
