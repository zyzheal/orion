/**
 * ROI Report - Monthly ROI by feature, improvement suggestions
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Table as AntTable,
  message,
} from 'antd';
import { ReloadOutlined, RiseOutlined, FundOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getROIReport } from '@/api/ai-cost';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface ROIFeatureData {
  feature: string;
  cost: number;
  timeSaved: number;
  qualityScore: number;
  roi: number;
}

interface ROISuggestion {
  id: string;
  category: string;
  description: string;
  potentialSaving: number;
  priority: 'high' | 'medium' | 'low';
}

const ROIFeatureReport: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('monthly');
  const [roiData, setRoiData] = useState<ROIFeatureData[]>([]);
  const [suggestions, setSuggestions] = useState<ROISuggestion[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getROIReport({ period });
      const data = res.data.data as { features?: ROIFeatureData[]; suggestions?: ROISuggestion[] };
      setRoiData(Array.isArray(data?.features) ? data.features : []);
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
    } catch (error: unknown) {
      // Mock data
      setRoiData([
        { feature: '代码审查', cost: 120.5, timeSaved: 45, qualityScore: 85, roi: 3.2 },
        { feature: '测试生成', cost: 89.3, timeSaved: 30, qualityScore: 78, roi: 2.8 },
        { feature: '文档编写', cost: 45.2, timeSaved: 20, qualityScore: 72, roi: 2.1 },
        { feature: 'Bug 诊断', cost: 67.8, timeSaved: 25, qualityScore: 90, roi: 3.5 },
        { feature: '配置管理', cost: 34.1, timeSaved: 15, qualityScore: 68, roi: 1.8 },
      ]);
      setSuggestions([
        {
          id: 's1',
          category: '模型选择',
          description: '将简单任务从 GPT-4 切换到 GPT-3.5-turbo',
          potentialSaving: 350,
          priority: 'high',
        },
        {
          id: 's2',
          category: '缓存优化',
          description: '启用响应缓存减少重复调用',
          potentialSaving: 200,
          priority: 'high',
        },
        {
          id: 's3',
          category: 'Token 优化',
          description: '优化 prompt 减少不必要的上下文',
          potentialSaving: 120,
          priority: 'medium',
        },
      ]);
      if (error instanceof Error) {
        message.warning(`加载ROI数据失败，使用模拟数据：${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const avgRoi =
    roiData.length > 0 ? roiData.reduce((sum, r) => sum + r.roi, 0) / roiData.length : 0;
  const totalSaving = suggestions.reduce((sum, s) => sum + s.potentialSaving, 0);

  const priorityColorMap: Record<string, string> = { high: 'red', medium: 'orange', low: 'blue' };

  const featureColumns: ColumnsType<ROIFeatureData> = [
    {
      key: 'feature',
      title: '功能',
      dataIndex: 'feature',
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'cost',
      title: '成本',
      dataIndex: 'cost',
      render: (v: unknown) => <Text>${Number(v).toFixed(2)}</Text>,
    },
    {
      key: 'timeSaved',
      title: '节省时间(小时)',
      dataIndex: 'timeSaved',
      render: (v: unknown) => <Text>{Number(v)}h</Text>,
    },
    {
      key: 'qualityScore',
      title: '质量评分',
      dataIndex: 'qualityScore',
      render: (v: unknown) => (
        <Tag
          color={
            Number(v) >= 80
              ? colors.success[500]
              : Number(v) >= 60
                ? colors.warning[500]
                : colors.error[400]
          }
        >
          {String(v)}分
        </Tag>
      ),
    },
    {
      key: 'roi',
      title: 'ROI',
      dataIndex: 'roi',
      render: (v: unknown) => (
        <Text strong style={{ color: Number(v) >= 2 ? colors.success[500] : colors.warning[500] }}>
          <RiseOutlined /> {Number(v).toFixed(1)}x
        </Text>
      ),
    },
  ];

  const suggestionColumns: ColumnsType<ROISuggestion> = [
    {
      key: 'category',
      title: '类别',
      dataIndex: 'category',
      render: (v: unknown) => <Tag>{String(v)}</Tag>,
    },
    {
      key: 'description',
      title: '建议',
      dataIndex: 'description',
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'potentialSaving',
      title: '预计节省',
      dataIndex: 'potentialSaving',
      render: (v: unknown) => (
        <Text strong style={{ color: colors.success[500] }}>
          ${Number(v)}/月
        </Text>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      render: (v: unknown) => <Tag color={priorityColorMap[String(v)]}>{String(v)}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            ROI 报告
          </Title>
          <Text type="secondary">AI 功能投资回报分析与优化建议</Text>
        </div>
        <Space>
          <Select
            value={period}
            onChange={setPeriod}
            style={{ width: 120 }}
            options={[
              { label: '本月', value: 'monthly' },
              { label: '本季度', value: 'quarterly' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均 ROI"
              value={avgRoi}
              precision={1}
              suffix="x"
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总投入"
              value={roiData.reduce((sum, r) => sum + r.cost, 0)}
              precision={2}
              prefix="$"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总节省时间"
              value={roiData.reduce((sum, r) => sum + r.timeSaved, 0)}
              suffix="小时"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="优化建议可节省"
              value={totalSaving}
              precision={0}
              prefix="$"
              suffix="/月"
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <FundOutlined />
            各功能 ROI 分析
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <AntTable
          columns={featureColumns}
          dataSource={roiData}
          loading={loading}
          rowKey="feature"
          size="middle"
        />
      </Card>

      <Card
        title={
          <Space>
            <RiseOutlined />
            优化建议
          </Space>
        }
      >
        <AntTable
          columns={suggestionColumns}
          dataSource={suggestions}
          loading={loading}
          rowKey="id"
          size="middle"
        />
      </Card>
    </div>
  );
};

export default ROIFeatureReport;
