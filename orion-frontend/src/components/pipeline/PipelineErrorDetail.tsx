/**
 * PipelineErrorDetail — Structured error display for failed pipeline runs.
 *
 * Uses the backend ErrorClassifier to show human-readable error messages
 * instead of raw logs. Displays:
 * - Error type icon (different per category)
 * - Severity badge (Critical / Warning / Info)
 * - Human-readable error message
 * - Suggested fix steps (numbered list)
 * - "View raw logs" toggle
 * - "Retry" button
 *
 * Integrated into PipelineDetail page when pipeline status is 'failed'.
 */
import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Collapse, Spin, Typography, Space, Alert, message } from 'antd';
import {
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ExperimentOutlined,
  CodeOutlined,
  CloudServerOutlined,
  SettingOutlined,
  ReloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getPipelineErrorDetail,
  getPipelineRun,
  type PipelineErrorDetailResponse,
} from '@/api/pipelines';

const { Text } = Typography;

// ==================== Icon mapping per error type ====================

const ERROR_TYPE_ICONS: Record<string, React.ReactNode> = {
  compilation_error: <CodeOutlined />,
  test_failure: <ExperimentOutlined />,
  deployment_failure: <CloudServerOutlined />,
  infrastructure_error: <CloudServerOutlined />,
  timeout_error: <InfoCircleOutlined />,
  configuration_error: <SettingOutlined />,
  unknown_error: <FileTextOutlined />,
};

// ==================== Severity config ====================

const SEVERITY_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  critical: {
    color: colors.error[500],
    label: 'Critical',
    icon: <CloseCircleOutlined />,
  },
  warning: {
    color: colors.warning[500],
    label: 'Warning',
    icon: <WarningOutlined />,
  },
  info: {
    color: colors.primary[500],
    label: 'Info',
    icon: <InfoCircleOutlined />,
  },
};

// ==================== Component Props ====================

export interface PipelineErrorDetailProps {
  /** Pipeline run ID */
  runId: string;
  /** Callback when user clicks retry */
  onRetry?: () => void;
}

/**
 * PipelineErrorDetail component.
 *
 * Fetches classified error detail from the backend and displays it
 * in a user-friendly card layout.
 */
const PipelineErrorDetail: React.FC<PipelineErrorDetailProps> = ({ runId, onRetry }) => {
  const [loading, setLoading] = useState(true);
  const [errorDetail, setErrorDetail] = useState<PipelineErrorDetailResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Fetch error detail on mount
  useEffect(() => {
    let cancelled = false;

    const fetchErrorDetail = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const response = await getPipelineErrorDetail(runId);
        if (!cancelled) {
          setErrorDetail(response.data as unknown as PipelineErrorDetailResponse | null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          // Check if it's an API error with a response
          const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
          if (axiosError.response?.status === 404) {
            setFetchError('未找到错误详情');
          } else if (axiosError.response?.status === 400) {
            // Run might not be failed, or error detail not applicable
            setFetchError(null);
          } else {
            setFetchError(axiosError.response?.data?.message || '加载错误详情失败');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (runId) {
      fetchErrorDetail();
    }

    return () => {
      cancelled = true;
    };
  }, [runId]);

  // Handle retry
  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Trigger a fresh run via the existing retry API
      const response = await getPipelineRun(runId);
      if ((response.data as { data?: { pipelineId?: string } }).data?.pipelineId) {
        // Use the retry endpoint via the pipelineRuns API
        const { retryPipelineRun } = await import('@/api/pipelineRuns');
        await retryPipelineRun(runId);
        message.success('Pipeline 已重新运行');
        onRetry?.();
        // Refresh error detail
        setErrorDetail(null);
        const detailResp = await getPipelineErrorDetail(runId);
        setErrorDetail((detailResp.data as { data?: unknown }).data as PipelineErrorDetailResponse | null);
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      message.error(`重新运行失败：${axiosError.response?.data?.message || '请稍后重试'}`);
    } finally {
      setRetrying(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card
        style={{
          borderLeft: `4px solid ${colors.warning[500]}`,
          marginBottom: spacing[4],
        }}
      >
        <div style={{ textAlign: 'center', padding: spacing[3] }}>
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            正在分析错误原因...
          </Text>
        </div>
      </Card>
    );
  }

  // Fetch error state
  if (fetchError) {
    return (
      <Alert
        type="warning"
        message="错误详情不可用"
        description={fetchError}
        showIcon
        style={{ marginBottom: spacing[4] }}
      />
    );
  }

  // No error detail (run might not be failed)
  if (!errorDetail) {
    return null;
  }

  const severityCfg = SEVERITY_CONFIG[errorDetail.severity] || SEVERITY_CONFIG.info;
  const icon = ERROR_TYPE_ICONS[errorDetail.errorType] || ERROR_TYPE_ICONS.unknown_error;

  return (
    <Card
      style={{
        borderLeft: `4px solid ${severityCfg.color}`,
        marginBottom: spacing[4],
        boxShadow: `0 2px 8px ${severityCfg.color}15`,
      }}
      bodyStyle={{ padding: spacing[4] }}
    >
      {/* Header: Icon + Severity + Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          marginBottom: spacing[3],
        }}
      >
        <span
          style={{
            fontSize: spacing[5],
            color: severityCfg.color,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </span>
        <Text strong style={{ fontSize: spacing[4] }}>
          {getErrorTypeLabel(errorDetail.errorType)}
        </Text>
        <Tag
          color={severityCfg.color}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: 'none',
            borderRadius: 4,
          }}
        >
          {severityCfg.icon}
          {severityCfg.label}
        </Tag>
        {errorDetail.stageName && errorDetail.stageName !== 'unknown' && (
          <Tag color="blue" style={{ marginLeft: 'auto' }}>
            阶段: {errorDetail.stageName}
          </Tag>
        )}
      </div>

      {/* Human-readable message */}
      <Alert
        type={
          errorDetail.severity === 'critical'
            ? 'error'
            : errorDetail.severity === 'warning'
              ? 'warning'
              : 'info'
        }
        message="错误分析结果"
        description={
          <div>
            <Text>{errorDetail.humanReadableMessage}</Text>
            {errorDetail.classification && (
              <div style={{ marginTop: spacing[2] }}>
                <Text type="secondary" style={{ fontSize: spacing[2] }}>
                  分类: {errorDetail.classification.type} (置信度:{' '}
                  {Math.round(errorDetail.classification.confidence * 100)}%)
                </Text>
              </div>
            )}
          </div>
        }
        showIcon
        style={{ marginBottom: spacing[3] }}
      />

      {/* Suggested fix steps */}
      {errorDetail.suggestedFix && errorDetail.suggestedFix.length > 0 && (
        <div style={{ marginBottom: spacing[3] }}>
          <Text strong style={{ display: 'block', marginBottom: spacing[2] }}>
            建议修复步骤:
          </Text>
          <ol
            style={{
              margin: 0,
              paddingLeft: spacing[4],
              listStyleType: 'decimal',
            }}
          >
            {errorDetail.suggestedFix.map((step, index) => (
              <li key={index} style={{ marginBottom: spacing[1] }}>
                <Text style={{ fontSize: spacing[3] }}>{step}</Text>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Raw logs toggle */}
      {errorDetail.rawError && (
        <Collapse
          size="small"
          ghost
          items={[
            {
              key: 'raw',
              label: (
                <Space>
                  <FileTextOutlined />
                  <Text type="secondary">查看原始错误日志</Text>
                </Space>
              ),
              children: (
                <pre
                  style={{
                    background: colors.neutral[900],
                    color: colors.neutral[300],
                    padding: spacing[3],
                    borderRadius: 6,
                    fontSize: spacing[2],
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    lineHeight: 1.6,
                    maxHeight: 300,
                    overflowY: 'auto',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {errorDetail.rawError}
                </pre>
              ),
            },
          ]}
        />
      )}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: spacing[2],
          marginTop: spacing[3],
          paddingTop: spacing[3],
          borderTop: `1px solid ${colors.light.border.light}`,
        }}
      >
        <Button
          icon={<ReloadOutlined spin={retrying} />}
          type="primary"
          danger
          loading={retrying}
          onClick={handleRetry}
        >
          重新运行
        </Button>
      </div>
    </Card>
  );
};

/**
 * Get display label for error type.
 */
function getErrorTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    compilation_error: '编译错误',
    test_failure: '测试失败',
    deployment_failure: '部署失败',
    infrastructure_error: '基础设施错误',
    timeout_error: '任务超时',
    configuration_error: '配置错误',
    unknown_error: '未知错误',
  };
  return labels[type] || '未知错误';
}

export default PipelineErrorDetail;
