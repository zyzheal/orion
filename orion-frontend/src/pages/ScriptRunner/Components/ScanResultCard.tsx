/**
 * ScanResultCard.tsx - 安全扫描结果卡
 * 抽取自 index.tsx (P2-9 Phase 230)
 */
import React from 'react';
import { Alert, Card, Space, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ScriptScanResult } from '@/api/scripts';

interface Props {
  result: ScriptScanResult;
}

export const ScanResultCard: React.FC<Props> = ({ result }) => (
  <Card
    title={
      <Space>
        <span>安全扫描结果</span>
        {result.passed ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            通过
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            未通过
          </Tag>
        )}
        <Tag color={result.riskScore > 70 ? 'error' : result.riskScore > 40 ? 'warning' : 'success'}>
          风险评分: {result.riskScore}
        </Tag>
      </Space>
    }
    style={{ marginBottom: spacing.md }}
  >
    {result.warnings.length > 0 && (
      <Alert
        type="warning"
        showIcon
        message={`警告 (${result.warnings.length})`}
        description={
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        }
        style={{ marginBottom: spacing.md }}
      />
    )}
    {result.errors.length > 0 && (
      <Alert
        type="error"
        showIcon
        message={`错误 (${result.errors.length})`}
        description={
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        }
      />
    )}
    {result.warnings.length === 0 && result.errors.length === 0 && (
      <Alert
        type="success"
        showIcon
        message="代码检查通过，未发现安全问题"
        description={<WarningOutlined />}
      />
    )}
  </Card>
);
