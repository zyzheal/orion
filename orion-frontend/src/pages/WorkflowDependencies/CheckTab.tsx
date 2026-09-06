/**
 * CheckTab.tsx - 单工作流检测 Tab
 * 抽取自 WorkflowDependencies/index.tsx (P2-9 Phase 85)
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Form,
  Input,
  Row,
  Col,
  Alert,
  Empty,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  SafetyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import type { DefinitionCheckResult } from '@/api/workflow-dependency';

const { Text, Paragraph } = Typography;

interface CheckTabProps {
  checkLoading: boolean;
  checkResult: DefinitionCheckResult | null;
  selectedDefinitionId: string;
  setSelectedDefinitionId: (id: string) => void;
  handleCheckDefinition: () => Promise<void>;
}

export const CheckTab: React.FC<CheckTabProps> = ({
  checkLoading,
  checkResult,
  selectedDefinitionId,
  setSelectedDefinitionId,
  handleCheckDefinition,
}) => {
  return (
    <div>
      <Card title="单工作流循环检测" style={{ marginBottom: spacing.lg }}>
        <Form layout="inline">
          <Form.Item label="工作流定义 ID" style={{ width: 300 }}>
            <Input
              placeholder="请输入工作流定义 ID"
              value={selectedDefinitionId}
              onChange={(e) => setSelectedDefinitionId(e.target.value)}
              onPressEnter={handleCheckDefinition}
              allowClear
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleCheckDefinition}
              loading={checkLoading}
            >
              检测
            </Button>
          </Form.Item>
        </Form>
        <Paragraph type="secondary" style={{ marginTop: spacing[3], marginBottom: 0 }}>
          输入要检查的工作流定义 ID，系统将分析其依赖链，判断是否存在循环依赖。
        </Paragraph>
      </Card>

      <Spin spinning={checkLoading}>
        {checkResult ? (
          <div>
            <Alert
              message={checkResult.isSafe ? '检测结果：安全' : '检测结果：存在循环依赖'}
              description={
                checkResult.isSafe
                  ? '该工作流定义不存在循环依赖，可以正常执行。'
                  : `该工作流存在 ${checkResult.cycles.length} 个循环依赖，可能导致执行时无限循环。`
              }
              type={checkResult.isSafe ? 'success' : 'error'}
              showIcon
              icon={checkResult.isSafe ? <SafetyOutlined /> : <WarningOutlined />}
              style={{ marginBottom: spacing.lg }}
            />

            <Row gutter={16}>
              <Col span={12}>
                <Card title="直接依赖的子流程" size="small">
                  {checkResult.dependencies.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {checkResult.dependencies.map((dep) => (
                        <Tag key={dep} color="blue">
                          {dep}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary">无直接依赖</Text>
                  )}
                </Card>
              </Col>

              <Col span={12}>
                <Card
                  title={
                    <Space>
                      <WarningOutlined style={{ color: colors.error[500] }} />
                      循环依赖
                    </Space>
                  }
                  size="small"
                >
                  {checkResult.cycles.length > 0 ? (
                    checkResult.cycles.map((cycle, index) => (
                      <div
                        key={String(index)}
                        style={{
                          padding: '8px',
                          marginBottom: spacing.sm,
                          background: colors.error[50],
                          borderRadius: 6,
                          borderLeft: `3px solid ${colors.error[500]}`,
                        }}
                      >
                        <Text strong>循环 #{index + 1}</Text>
                        <div style={{ marginTop: 4 }}>{cycle.names.join(' → ')}</div>
                      </div>
                    ))
                  ) : (
                    <Text type="secondary">无循环依赖</Text>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        ) : (
          <Card>
            <Empty
              description="请输入工作流定义 ID 并点击检测按钮"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};
