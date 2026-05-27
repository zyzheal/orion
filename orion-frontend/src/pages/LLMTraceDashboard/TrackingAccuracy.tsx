/**
 * LLM Trace Accuracy - Tracking accuracy metrics
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Card,
  Row,
  Col,
  Progress,
  Statistic,
  Tag,
  message,
  Spin,
} from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, AimOutlined,} from '@ant-design/icons';
import { getTrackingAccuracy, type TrackingAccuracy } from '@/api/llm-trace';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const TrackingAccuracyView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accuracy, setAccuracy] = useState<TrackingAccuracy | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getTrackingAccuracy();
      setAccuracy(response.data as TrackingAccuracy | null);
    } catch (error: unknown) {
      setAccuracy(null);
      message.error(`加载精度数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: spacing[8] }}>
        <Spin size="large" />
      </div>
    );
  }

  const accuracyPercent = accuracy ? Math.round(accuracy.accuracy * 100) : 0;
  const meetsTarget = accuracy?.meetsTarget ?? false;

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
          <Title level={2} style={{ marginBottom: 8 }}>
            <AimOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            追踪精度监控
          </Title>
          <Text type="secondary">
            LLM 调用追踪准确度与成功率统计
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Accuracy Progress */}
      <Card style={{ marginBottom: spacing[6] }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Title level={4} style={{ marginBottom: 8 }}>
              追踪准确率
            </Title>
            <Progress
              type="circle"
              percent={accuracyPercent}
              strokeColor={meetsTarget ? colors.success[500] : colors.error[500]}
              format={(percent) => (
                <span style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {percent}%
                </span>
              )}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="目标准确率"
              value={accuracy?.targetAccuracy ? Math.round(accuracy.targetAccuracy * 100) : 98}
              suffix="%"
            />
            <div style={{ marginTop: 8 }}>
              {meetsTarget ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  达标
                </Tag>
              ) : (
                <Tag color="error" icon={<CloseCircleOutlined />}>
                  未达标
                </Tag>
              )}
            </div>
          </Col>
          <Col span={8}>
            <Statistic
              title="差距"
              value={accuracy ? Math.round((accuracy.accuracy - accuracy.targetAccuracy) * 100) : 0}
              suffix="%"
              valueStyle={{
                color: meetsTarget ? colors.success[600] : colors.error[600],
              }}
            />
          </Col>
        </Row>
      </Card>

      {/* Detailed Stats */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="完成追踪"
              value={accuracy?.completed || 0}
              valueStyle={{ color: colors.success[600] }}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败追踪"
              value={accuracy?.failed || 0}
              valueStyle={{ color: colors.error[600] }}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总追踪数"
              value={accuracy?.total || 0}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={accuracy ? Math.round((accuracy.completed / accuracy.total) * 100) : 0}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Explanation */}
      <Card style={{ marginTop: spacing[6] }}>
        <Title level={5}>追踪精度说明</Title>
        <Text type="secondary">
          追踪精度衡量 LLM 调用链路追踪的完整性和准确性。
          精度指标包括：Prompt 记录完整性、Token 计数准确度、成本计算准确性。
          目标精度 98% 表示只有不超过 2% 的调用存在追踪数据缺失或计算偏差。
        </Text>
      </Card>
    </div>
  );
};

export default TrackingAccuracyView;