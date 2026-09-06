/**
 * Anomaly Detection Tab
 * 异常检测 Tab（抽取自 CostOperationsPage.tsx）
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Alert,
  message,
} from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import {
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { getCostAnomalies, type CostAnomaly } from '@/api/cost-operations';
import { severityColorMap, anomalyTypeMap } from './constants';

const { Text } = Typography;

export const AnomalyDetectionTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<CostAnomaly[]>([]);

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      const res = await getCostAnomalies({ days: 7 });
      setAnomalies(res.data?.anomalies || []);
    } catch (error: unknown) {
      message.error(`加载异常检测数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnomalies();
  }, []);

  const columns = [
    {
      title: '服务',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: 160,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '异常类型',
      dataIndex: 'anomalyType',
      key: 'anomalyType',
      width: 120,
      render: (v: string) => (
        <Tag color={v === 'spike' ? 'error' : v === 'drop' ? 'success' : 'warning'}>
          {anomalyTypeMap[v]}
        </Tag>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: string) => <Tag color={severityColorMap[v]}>{v}</Tag>,
    },
    {
      title: '预期成本',
      key: 'expected',
      width: 100,
      render: (_: unknown, r: CostAnomaly) => `¥${r.expectedCost.toFixed(2)}`,
    },
    {
      title: '实际成本',
      key: 'actual',
      width: 100,
      render: (_: unknown, r: CostAnomaly) => `¥${r.actualCost.toFixed(2)}`,
    },
    {
      title: '偏差',
      key: 'deviation',
      width: 80,
      render: (_: unknown, r: CostAnomaly) => (
        <Text style={{ color: r.deviation > 0 ? colors.error[400] : colors.success[500] }}>
          {r.deviation > 0 ? '+' : ''}
          {r.deviation.toFixed(1)}%
        </Text>
      ),
    },
    {
      title: '检测时间',
      dataIndex: 'detectedAt',
      key: 'detectedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  return (
    <div>
      <div
        style={
          {
            marginBottom: spacing.md,
            display: 'flex',
            justifyContent: 'space-between',
          } as React.CSSProperties
        }
      >
        <Text type="secondary">自动检测成本异常波动</Text>
        <Button icon={<ReloadOutlined />} onClick={loadAnomalies} loading={loading}>
          刷新
        </Button>
      </div>

      {anomalies.length === 0 && !loading && (
        <Card>
          <Alert
            message="未检测到异常"
            description="过去 7 天内未发现成本异常波动"
            type="success"
            icon={<CheckCircleOutlined />}
          />
        </Card>
      )}

      {anomalies.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: colors.warning[500] }} />
              <span>检测到 {anomalies.length} 个异常</span>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={anomalies}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}
    </div>
  );
};
