/**
 * Runbook detail drawer (with execution history)
 * 抽取自 index.tsx (P2-9 Phase 163)
 */
import { Descriptions, Drawer, Empty, Table, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { RunbookDefinition, RunbookExecution } from '@/api/runbooks';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

interface DetailDrawerProps {
  open: boolean;
  runbook: RunbookDefinition | null;
  executions: RunbookExecution[];
  executionColumns: ColumnsType<RunbookExecution>;
  onClose: () => void;
}

export const DetailDrawer = ({
  open,
  runbook,
  executions,
  executionColumns,
  onClose,
}: DetailDrawerProps) => (
  <Drawer title={runbook?.name} open={open} onClose={onClose} width={600}>
    {runbook && (
      <>
        <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
          <Descriptions.Item label="分类">{runbook.category}</Descriptions.Item>
          <Descriptions.Item label="描述">{runbook.description ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={runbook.enabled ? 'green' : 'default'}>
              {runbook.enabled ? '启用' : '禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="步骤数">
            {runbook.steps?.length ?? 0}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(runbook.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>

        <Title level={4}>执行历史</Title>
        {executions.length === 0 ? (
          <Empty description="暂无执行记录" />
        ) : (
          <Table
            columns={executionColumns}
            dataSource={executions}
            rowKey="id"
            size="small"
            pagination={false}
          />
        )}
      </>
    )}
  </Drawer>
);
