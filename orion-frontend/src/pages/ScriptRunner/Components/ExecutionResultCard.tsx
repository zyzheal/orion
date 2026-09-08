/**
 * ExecutionResultCard.tsx - 执行结果卡
 * 抽取自 index.tsx (P2-9 Phase 230)
 */
import React from 'react';
import { Alert, Card, Space, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ScriptExecutionResult } from '@/api/scripts';

interface Props {
  result: ScriptExecutionResult;
}

export const ExecutionResultCard: React.FC<Props> = ({ result }) => (
  <Card
    title={
      <Space>
        <span>执行结果</span>
        {result.success ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            成功
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            失败
          </Tag>
        )}
        {result.durationMs != null && (
          <Tag color="processing">耗时: {result.durationMs}ms</Tag>
        )}
        {result.exitCode != null && (
          <Tag color={result.exitCode === 0 ? 'success' : 'error'}>
            Exit Code: {result.exitCode}
          </Tag>
        )}
      </Space>
    }
    style={{ marginBottom: spacing.md }}
  >
    {result.output && (
      <Card
        size="small"
        title="标准输出"
        style={{
          marginBottom: spacing.md,
          background: '#f5f5f5',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
          {result.output}
        </pre>
      </Card>
    )}
    {result.error && (
      <Alert
        type="error"
        showIcon
        message="错误信息"
        description={result.error}
      />
    )}
  </Card>
);
