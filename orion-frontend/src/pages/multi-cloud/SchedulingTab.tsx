/**
 * SchedulingTab.tsx - 资源调度 Tab
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import {
  Card,
  Form,
  Button,
  Row,
  Col,
  Select,
  Input,
  Descriptions,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ScheduleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { buildScheduleAlternativeColumns } from './MultiCloudAdvancedColumns';
import {
  SCHEDULING_RESOURCE_TYPE_OPTIONS,
  SCHEDULING_PROVIDER_OPTIONS,
} from './MultiCloudAdvancedConfig';
import type { ScheduleResourceInput } from './useMultiCloudAdvancedState';
import type { SchedulingPolicy, SchedulingDecision } from '@/api/multi-cloud';

const { Text } = Typography;

export interface SchedulingTabProps {
  schedulingPolicies: SchedulingPolicy[];
  scheduleResult: SchedulingDecision | null;
  scheduleResultLoading: boolean;
  onCreateSchedule: () => void;
  onSchedule: (values: ScheduleResourceInput) => void;
}

export const SchedulingTab: React.FC<SchedulingTabProps> = ({
  schedulingPolicies,
  scheduleResult,
  scheduleResultLoading,
  onCreateSchedule,
  onSchedule,
}) => (
  <Row gutter={16}>
    <Col span={12}>
      <Card
        title="资源调度面板"
        style={{ borderRadius: 12 }}
        extra={
          <Button type="primary" icon={<ScheduleOutlined />} onClick={onCreateSchedule}>
            新建调度
          </Button>
        }
      >
        <Form layout="vertical" onFinish={onSchedule}>
          <Form.Item label="资源类型" name="resourceType" rules={[{ required: true }]}>
            <Select options={SCHEDULING_RESOURCE_TYPE_OPTIONS} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="CPU (核)" name="cpu" initialValue={2}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="内存 (MB)" name="memoryMb" initialValue={4096}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="存储 (GB)" name="storageGb" initialValue={100}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="调度策略" name="policyId">
            <Select
              placeholder="选择调度策略（可选）"
              allowClear
              options={schedulingPolicies.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.strategy})`,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="首选厂商" name="preferredProvider">
                <Select placeholder="不限" allowClear options={SCHEDULING_PROVIDER_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="首选区域" name="preferredRegion">
                <Input placeholder="如: us-east-1" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={scheduleResultLoading}
              icon={<ScheduleOutlined />}
            >
              生成调度决策
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Col>
    <Col span={12}>
      <Card title="调度决策结果" style={{ borderRadius: 12 }}>
        {scheduleResult ? (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="推荐厂商">
                <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {scheduleResult.selectedProvider.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="推荐区域">
                <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {scheduleResult.selectedRegion}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="预估月费">
                <Text strong style={{ color: colors.primary[500], fontSize: 18 }}>
                  ${scheduleResult.estimatedCost.toFixed(2)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="决策原因">{scheduleResult.reason}</Descriptions.Item>
            </Descriptions>

            {scheduleResult.alternatives.length > 0 && (
              <div style={{ marginTop: spacing.md }}>
                <Text strong>备选方案</Text>
                <Table
                  dataSource={scheduleResult.alternatives}
                  rowKey={(r) => `${r.provider}-${r.region}`}
                  size="small"
                  pagination={false}
                  style={{ marginTop: spacing.sm }}
                  columns={buildScheduleAlternativeColumns()}
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <ScheduleOutlined
              style={{ fontSize: 48, color: colors.neutral[300], marginBottom: spacing.md }}
            />
            <div>
              <Text type="secondary">填写左侧参数并提交，生成资源调度决策</Text>
            </div>
          </div>
        )}
      </Card>
    </Col>
  </Row>
);

export default SchedulingTab;
