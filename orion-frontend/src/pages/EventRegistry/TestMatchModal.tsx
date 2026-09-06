/**
 * TestMatchModal.tsx - 测试事件匹配 Modal
 * 抽取自 EventRegistry/index.tsx (P2-9 Phase 63)
 */
import React from 'react';
import {
  Typography,
  Space,
  Tag,
  Card,
  Select,
  Input,
  Divider,
  Modal,
  Button,
  Empty,
} from 'antd';
import {
  ExperimentOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { categoryColorMap } from './constants';
import type { EventTypeInfo, TestMatchResult } from '@/api/event-registry';

const { Text, Paragraph } = Typography;

interface TestMatchModalProps {
  open: boolean;
  onClose: () => void;
  eventTypes: EventTypeInfo[];
  selectedEventType: string;
  setSelectedEventType: (v: string) => void;
  testPayload: string;
  setTestPayload: (v: string) => void;
  testResults: TestMatchResult[];
  loadingTestMatch: boolean;
  onRunTest: () => void;
  onCopySample: (sample: Record<string, unknown>) => void;
}

export const TestMatchModal: React.FC<TestMatchModalProps> = ({
  open,
  onClose,
  eventTypes,
  selectedEventType,
  setSelectedEventType,
  testPayload,
  setTestPayload,
  testResults,
  loadingTestMatch,
  onRunTest,
  onCopySample,
}) => (
  <Modal
    title={
      <Space>
        <ExperimentOutlined /> 测试事件匹配
      </Space>
    }
    open={open}
    onCancel={onClose}
    width={800}
    footer={[
      <Button key="cancel" onClick={onClose}>
        关闭
      </Button>,
      <Button
        key="test"
        type="primary"
        loading={loadingTestMatch}
        onClick={onRunTest}
        disabled={!selectedEventType}
      >
        执行测试
      </Button>,
    ]}
  >
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Text strong>选择事件类型:</Text>
        <Select
          style={{ width: '100%', marginTop: spacing.xs }}
          placeholder="选择事件类型"
          value={selectedEventType || undefined}
          onChange={setSelectedEventType}
          showSearch
          options={eventTypes.map((et) => ({
            label: (
              <Space>
                <Tag color={categoryColorMap[et.category]} style={{ margin: 0 }}>
                  {et.category}
                </Tag>
                {et.type}
              </Space>
            ),
            value: et.type,
          }))}
        />
      </div>

      <div>
        <Text strong>输入事件 Payload (JSON):</Text>
        <Input.TextArea
          style={{ marginTop: spacing.xs, fontFamily: 'monospace', fontSize: 12 }}
          rows={8}
          value={testPayload}
          onChange={(e) => setTestPayload(e.target.value)}
          placeholder='{"key": "value"}'
        />
      </div>

      {selectedEventType &&
        eventTypes.find((et) => et.type === selectedEventType) && (
          <Card
            size="small"
            title="示例 Payload"
            extra={
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined />}
                onClick={() =>
                  onCopySample(
                    eventTypes.find((et) => et.type === selectedEventType)!.samplePayload,
                  )
                }
              >
                复制
              </Button>
            }
          >
            <pre style={{ margin: 0, fontSize: 11 }}>
              {JSON.stringify(
                eventTypes.find((et) => et.type === selectedEventType)?.samplePayload,
                null,
                2,
              )}
            </pre>
          </Card>
        )}

      <Divider />

      <div>
        <Text strong>匹配结果:</Text>
        {testResults.length > 0 ? (
          <div style={{ marginTop: spacing.sm }}>
            {testResults.map((result, idx) => (
              <Card
                key={String(idx)}
                size="small"
                style={{
                  marginBottom: spacing.sm,
                  borderLeft: result.matched
                    ? `3px solid ${colors.success[500]}`
                    : `3px solid ${colors.error[500]}`,
                }}
              >
                <Space>
                  {result.matched ? (
                    <CheckCircleOutlined style={{ color: colors.success[500], fontSize: 16 }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: colors.error[500], fontSize: 16 }} />
                  )}
                  <Text strong>{result.triggerName}</Text>
                  <Tag color={result.matched ? 'success' : 'error'}>
                    {result.matched ? '匹配' : '不匹配'}
                  </Tag>
                </Space>
                <Paragraph
                  type="secondary"
                  style={{ fontSize: 12, marginTop: spacing.xs, marginBottom: 0 }}
                >
                  {result.matchDetails}
                </Paragraph>
                {result.matchedFields && Object.keys(result.matchedFields).length > 0 && (
                  <div style={{ marginTop: spacing.xs }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      匹配的字段:
                    </Text>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 10,
                        background: colors.neutral[50],
                        padding: 4,
                      }}
                    >
                      {JSON.stringify(result.matchedFields, null, 2)}
                    </pre>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Empty description="点击「执行测试」查看匹配结果" style={{ marginTop: spacing.md }} />
        )}
      </div>
    </Space>
  </Modal>
);
