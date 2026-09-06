/**
 * Optimization Tab
 * 优化建议 Tab（抽取自 CostOperationsPage.tsx）
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Alert,
  message,
} from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { ReloadOutlined, BulbOutlined } from '@ant-design/icons';
import {
  getOptimizationSuggestions,
  applyOptimization,
  rejectOptimization,
  type OptimizationSuggestion,
} from '@/api/cost-operations';
import { suggestionStatusMap, categoryLabelMap, effortColorMap } from './constants';

const { Text } = Typography;

export const OptimizationTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { category: filter } : undefined;
      const res = await getOptimizationSuggestions(params);
      setSuggestions(res.data?.suggestions || []);
    } catch (error: unknown) {
      message.error(`加载优化建议失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [filter]);

  const handleApply = async (id: string) => {
    try {
      await applyOptimization(id);
      message.success('优化建议已应用');
      loadSuggestions();
    } catch (error: unknown) {
      message.error(`应用失败: ${(error as Error).message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectOptimization(id);
      message.success('已忽略该建议');
      loadSuggestions();
    } catch (error: unknown) {
      message.error(`操作失败: ${(error as Error).message}`);
    }
  };

  const columns = [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => <Tag color="blue">{categoryLabelMap[v] || v}</Tag>,
    },
    { title: '服务', dataIndex: 'serviceName', key: 'serviceName', width: 140 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '预计节省',
      dataIndex: 'potentialSavings',
      key: 'potentialSavings',
      width: 100,
      render: (v: number) => (
        <Text strong style={{ color: colors.success[500] }}>
          ¥{v.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 80,
      render: (v: number) => `${Math.round(v * 100)}%`,
    },
    {
      title: '实施难度',
      dataIndex: 'effort',
      key: 'effort',
      width: 80,
      render: (v: string) => <Tag color={effortColorMap[v]}>{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={suggestionStatusMap[v]}>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: OptimizationSuggestion) =>
        record.status === 'pending' ? (
          <Space size="small">
            <Button
              type="link"
              size="small"
              style={{ color: colors.success[500] }}
              onClick={() => handleApply(record.id)}
            >
              应用
            </Button>
            <Button type="link" size="small" danger onClick={() => handleReject(record.id)}>
              忽略
            </Button>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
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
        <Space>
          <Text type="secondary">AI 驱动的成本优化建议</Text>
          <Select
            style={{ width: 140 }}
            value={filter}
            onChange={setFilter}
            options={[
              { label: '全部类别', value: 'all' },
              { label: '计算资源', value: 'compute' },
              { label: '存储资源', value: 'storage' },
              { label: '网络资源', value: 'network' },
              { label: '闲置资源', value: 'idle' },
              { label: '规格优化', value: 'rightsizing' },
            ]}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadSuggestions} loading={loading}>
          刷新
        </Button>
      </div>

      {suggestions.length > 0 && (
        <Card
          title={
            <span>
              <BulbOutlined style={{ color: colors.warning[500] }} /> 优化建议 (
              {suggestions.length}
              )
            </span>
          }
        >
          <Table
            columns={columns}
            dataSource={suggestions}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {suggestions.length === 0 && !loading && (
        <Card>
          <Alert
            message="暂无优化建议"
            description="当前资源配置良好，或者 AI 正在分析中"
            type="info"
          />
        </Card>
      )}
    </div>
  );
};
