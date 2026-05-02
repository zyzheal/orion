import React from 'react';
import { Button, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ArrowRightOutlined, ExportOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { useActionHandler } from './useActionHandler';
import type { ExtendedAction } from './types';
import { hasTarget } from './types';

const statusIcons = {
  success: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  failed: <CloseCircleOutlined style={{ color: colors.error[400] }} />,
  running: <LoadingOutlined style={{ color: colors.warning[500] }} />,
};

/** Get a small icon for the action type */
function getActionIcon(action: ExtendedAction): React.ReactNode {
  if (hasTarget(action)) {
    if (action.target?.externalUrl) {
      return <ExportOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
    }
    return <ArrowRightOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }} />;
  }
  return null;
}

export const ActionCard: React.FC<{
  actions: ExtendedAction[];
  status?: 'success' | 'failed' | 'running';
}> = ({ actions, status }) => {
  const handleAction = useActionHandler();

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          {statusIcons[status]} {status}
        </div>
      )}
      <Space wrap>
        {actions.map((action) => (
          <Button
            key={action.label}
            size="small"
            type="default"
            onClick={() => handleAction(action)}
          >
            {action.label}
            {getActionIcon(action)}
          </Button>
        ))}
      </Space>
    </div>
  );
};
