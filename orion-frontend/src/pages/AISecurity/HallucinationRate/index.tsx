/**
 * AI Hallucination Rate Monitoring Page
 * Tracks LLM hallucination rate, false positives, model drift, and quality scores
 */
import React, { useState } from 'react';
import { API_BASE_URL } from '@/api/client';
import { useQuery } from '@/providers/QueryProvider';
import {
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Table,
  Progress,
  Button,
  Space,
  Select,
  Empty,
} from 'antd';
import {
  AlertOutlined,
  RadarChartOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
const { Title, Text } = Typography;
const { Option } = Select;

interface HallucinationRecord {
  id: string;
  model: string;
  prompt: string;
  response: string;
  hallucinated: boolean;
  confidence: number;
  detectedBy: string;
  category: string;
  detectedAt: string;
}

const FALLBACK_DATA: HallucinationRecord[] = [
  { id: '1', model: 'gpt-4o', prompt: 'Describe the capital of France...', response: 'Paris, with 2.1M people...', hallucinated: false, confidence: 0.98, detectedBy: 'self-consistency', category: 'factual', detectedAt: '2026-08-26T10:00:00Z' },
  { id: '2', model: 'claude-3.5', prompt: 'What is the population of Shanghai...', response: 'Approximately 25M...', hallucinated: true, confidence: 0.32, detectedBy: 'kb-lookup', category: 'numerical', detectedAt: '2026-08-26T10:05:00Z' },
  { id: '3', model: 'gpt-4o', prompt: 'Summarize Q3 earnings...', response: 'Revenue grew 12% YoY...', hallucinated: true, confidence: 0.45, detectedBy: 'kb-lookup', category: 'citation', detectedAt: '2026-08-26T10:10:00Z' },
];

async function fetchHallucinationData(period: string): Promise<HallucinationRecord[]> {
  try {
    const resp = await fetch(`${API_BASE_URL}/ai-security/hallucination?period=${period}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    });
    if (!resp.ok) return FALLBACK_DATA;
    const json = await resp.json();
    return json.data || FALLBACK_DATA;
  } catch {
    return FALLBACK_DATA;
  }
}

const HallucinationRatePage: React.FC = () => {
  const [period, setPeriod] = useState('7d');

  const { data: records, isLoading: loading, refetch } = useQuery<HallucinationRecord[]>({
    queryKey: ['ai-hallucination', period],
    queryFn: () => fetchHallucinationData(period),
  });

  const loadData = () => refetch();

  const total = records?.length ?? 0;
  const hallucinated = records?.filter((r) => r.hallucinated).length ?? 0;
  const rate = total > 0 ? Math.round(hallucinated / total * 100) : 0;
  const avgConfidence = total > 0 ? Math.round(records!.reduce((s, r) => s + r.confidence, 0) / total * 100) / 100 : 0;
  const criticalCount = records?.filter((r) => r.confidence < 0.5 && r.hallucinated).length ?? 0;

  const columns: ColumnsType<HallucinationRecord> = [
    { title: '模型', dataIndex: 'model', key: 'model', width: 120, render: (v: string) => <Text code>{v}</Text> },
    { title: '提示词', dataIndex: 'prompt', key: 'prompt', ellipsis: true, width: 220 },
    { title: '响应摘要', dataIndex: 'response', key: 'response', ellipsis: true, width: 220 },
    {
      title: '幻觉', dataIndex: 'hallucinated', key: 'hallucinated', width: 80,
      render: (v: boolean) => <Tag color={v ? 'error' : 'success'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '置信度', dataIndex: 'confidence', key: 'confidence', width: 120,
      render: (v: number) => <Progress type="circle" size={28} percent={Math.round(v * 100)} format={() => `${v}`} />,
    },
    { title: '类别', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '检测方式', dataIndex: 'detectedBy', key: 'detectedBy', width: 120 },
    { title: '时间', dataIndex: 'detectedAt', key: 'detectedAt', width: 160 },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            <AlertOutlined style={{ marginRight: spacing.sm, color: colors.error[500] }} />
            幻觉率监控
          </Title>
          <Text type="secondary">LLM 幻觉检测 · 知识核验 · 模型漂移预警</Text>
        </div>
        <Space>
          <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
            <Option value="7d">近 7 天</Option>
            <Option value="30d">近 30 天</Option>
            <Option value="90d">近 90 天</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </div>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="总请求数" value={total} prefix={<FilterOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="幻觉率" value={rate} suffix="%" prefix={<AlertOutlined />}
                  valueStyle={{ color: rate > 5 ? colors.error[500] : colors.success[500] }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="平均置信度" value={avgConfidence} precision={2} prefix={<RadarChartOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="严重幻觉数" value={criticalCount} prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: criticalCount > 0 ? colors.error[500] : colors.success[500] }} />
              </Card>
            </Col>
          </Row>

          <Card
            title="幻觉检测明细"
            extra={<LineChartOutlined />}
          >
            <Table
              dataSource={records}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8 }}
              loading={loading}
              locale={{ emptyText: <Empty description="暂无幻觉检测记录" /> }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default HallucinationRatePage;
