/**
 * Header - Pipeline 列表标题栏
 * 抽取自 index.tsx (P2-9 Phase 108)
 */
import React, { useCallback } from 'react';
import { Row, Col, Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { PermissionActions, type PermissionAction } from '@/components/PermissionActions';
import { spacing } from '@/tokens';
import type { PipelineListState } from '../usePipelineListState';

const { Title, Text } = Typography;

interface HeaderProps {
  state: PipelineListState;
}

export const Header: React.FC<HeaderProps> = ({ state }) => {
  const createPermissionAction = useCallback(
    (key: string, label: string, onClick?: () => void): PermissionAction => ({
      key,
      label,
      onClick,
    }),
    []
  );

  return (
    <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
      <Col>
        <Title level={4} style={{ margin: 0 }}>
          Pipeline 列表
          <Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
            共 {state.total} 条
          </Text>
        </Title>
      </Col>
      <Col>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={state.refresh} loading={state.loading}>
            刷新
          </Button>
          <PermissionActions
            resource="pipeline"
            actions={[
              createPermissionAction(
                'write',
                '新建 Pipeline',
                () => state.navigate('/pipelines/new')
              ),
            ]}
            render={(action: PermissionAction, hasPermission: boolean) => (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={action.onClick}
                disabled={action.disabled ?? !hasPermission}
              >
                {action.label}
              </Button>
            )}
          />
        </Space>
      </Col>
    </Row>
  );
};
