/**
 * Confirmation Detail - Full detail with AI suggestion, confidence meter, countdown timer, approve/reject/comment
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Progress, Input, message, Descriptions, Statistic, Row, Col, Divider } from 'antd';
import { colors } from '@/tokens';
import { CheckOutlined, CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getConfirmation, approveConfirmation, rejectConfirmation, type ConfirmationRequest } from '@/api/confirmations';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const priorityColorMap: Record<string, string> = {
  P0: colors.error[400],
  P1: colors.warning[500],
  P2: colors.warning[500],
  P3: colors.success[500],
};

const ConfirmationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (confirmationId: string) => {
    setLoading(true);
    try {
      const res = await getConfirmation(confirmationId);
      setConfirmation(res.data.data as ConfirmationRequest | null);
    } catch {
      message.error('Failed to load confirmation');
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (confirmation?.status !== 'pending' || !confirmation?.pushTime) return;
    const interval = setInterval(() => {
      setElapsedSeconds(dayjs().diff(dayjs(confirmation.pushTime), 'second'));
    }, 1000);
    return () => clearInterval(interval);
  }, [confirmation]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!confirmation) return;
    setProcessing(true);
    try {
      if (action === 'approve') {
        await approveConfirmation(confirmation.id, { comment });
        message.success('已确认');
      } else {
        await rejectConfirmation(confirmation.id, { comment });
        message.success('已拒绝');
      }
      setComment('');
      loadData(confirmation.id);
    } catch {
      message.error('操作失败');
    } finally {
      setProcessing(false);
    }
  };

  if (loading && !confirmation) {
    return <div style={{ padding: 24 }}>加载中...</div>;
  }

  if (!confirmation) {
    return <div style={{ padding: 24 }}>未找到确认请求</div>;
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>返回</Button>
        <Title level={3} style={{ margin: 0 }}>确认详情</Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="确认 ID">{confirmation.id}</Descriptions.Item>
          <Descriptions.Item label="场景类型">
            <Tag color="blue">{confirmation.sceneType}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag color={priorityColorMap[confirmation.priority]} style={{ fontWeight: 'bold' }}>
              {confirmation.priority}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={confirmation.status === 'pending' ? 'processing' : confirmation.status === 'confirmed' ? 'success' : 'error'}>
              {confirmation.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="推送时间">{dayjs(confirmation.pushTime).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          <Descriptions.Item label="响应时间">
            {confirmation.responseTime ? dayjs(confirmation.responseTime).format('YYYY-MM-DD HH:mm:ss') : '未响应'}
          </Descriptions.Item>
          <Descriptions.Item label="响应人">{confirmation.responder || '-'}</Descriptions.Item>
          {confirmation.status === 'pending' && (
            <Descriptions.Item label="已等待">
              <Text type="danger">{minutes}分{seconds}秒</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="AI 建议" style={{ marginBottom: 16 }}>
        <Text>{confirmation.aiSuggestion}</Text>
        <Divider />
        <Row gutter={16}>
          <Col span={12}>
            <Statistic title="AI 置信度" value={confirmation.aiConfidence} suffix="%" />
          </Col>
          <Col span={12}>
            <Progress
              percent={confirmation.aiConfidence}
              strokeColor={confirmation.aiConfidence >= 80 ? colors.success[500] : confirmation.aiConfidence >= 60 ? colors.warning[500] : colors.error[400]}
            />
          </Col>
        </Row>
      </Card>

      {confirmation.comment && (
        <Card title="备注" style={{ marginBottom: 16 }}><Text>{confirmation.comment}</Text></Card>
      )}

      {confirmation.status === 'pending' && (
        <Card title="操作">
          <Input.TextArea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="输入备注..." style={{ marginBottom: 16 }} />
          <Space>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAction('approve')} loading={processing}>
              确认
            </Button>
            <Button danger icon={<CloseOutlined />} onClick={() => handleAction('reject')} loading={processing}>
              拒绝
            </Button>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default ConfirmationDetail;
