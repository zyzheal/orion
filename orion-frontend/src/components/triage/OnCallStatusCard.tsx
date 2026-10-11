import React from 'react';
import { Card, Typography, Tag, Button } from 'antd';
import { ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import type { OnCallInfo } from '../../api/triage';

const { Text } = Typography;

interface Props {
  info: OnCallInfo;
  onHandoff?: () => void;
}

export const OnCallStatusCard: React.FC<Props> = ({ info, onHandoff }) => {
  if (!info) {
    return null;
  }

  const isOnDuty = info.is_on_duty;

  return (
    <Card
      size="small"
      className="orion-card"
      style={{ borderColor: isOnDuty ? '#52c41a' : '#d9d9d9' }}
      aria-label={`值班状态: ${isOnDuty ? '值班中' : '未值班'}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text strong style={{ fontSize: 14 }}>
            <UserOutlined /> {info.display_name || info.user_id}
          </Text>
          {isOnDuty ? (
            <Tag color="success" icon={<ClockCircleOutlined />} style={{ marginLeft: 8 }}>
              值班中 · {info.shift_role === 'secondary' ? '备' : '主'}
            </Tag>
          ) : (
            <Tag color="default">未值班</Tag>
          )}
          {info.handoff_pending && (
            <Tag color="warning" style={{ marginLeft: 8 }}>
              待交接
            </Tag>
          )}
        </div>
        {onHandoff && (
          <Button
            size="small"
            aria-label="发起值班交接"
            aria-keyshortcuts="h"
            onClick={onHandoff}
          >
            交接
          </Button>
        )}
      </div>
      {isOnDuty && info.shift_start && info.shift_end && (
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          <ClockCircleOutlined /> {new Date(info.shift_start).toLocaleTimeString()} - {new Date(info.shift_end).toLocaleTimeString()}
        </Text>
      )}
    </Card>
  );
};

export default OnCallStatusCard;
