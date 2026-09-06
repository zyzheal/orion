/**
 * HistoryTab - 执行历史 Tab
 * 抽取自 index.tsx，含脚本选择器 + 执行历史表
 */
import React, { useMemo } from 'react';
import { Card, Row, Col, Space, Select, Button, Table, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ScriptEntry, ScriptExecution } from '@/api/script-library';
import { buildExecutionColumns } from './columns';

export interface HistoryTabProps {
  scripts: ScriptEntry[];
  executions: ScriptExecution[];
  executionsLoading: boolean;
  historyScriptId: string | undefined;
  setHistoryScriptId: (v: string | undefined) => void;
  fetchExecutions: () => void;
  setSelectedExecution: (e: ScriptExecution) => void;
  setExecDetailVisible: (v: boolean) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = (props) => {
  const {
    scripts, executions, executionsLoading,
    historyScriptId, setHistoryScriptId, fetchExecutions,
    setSelectedExecution, setExecDetailVisible,
  } = props;

  const columns = useMemo(
    () => buildExecutionColumns({ scripts, setSelectedExecution, setExecDetailVisible }),
    [scripts, setSelectedExecution, setExecDetailVisible]
  );

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Select
              placeholder="选择脚本查看执行历史"
              style={{ width: 300 }}
              showSearch
              optionFilterProp="children"
              value={historyScriptId}
              onChange={(val) => setHistoryScriptId(val)}
            >
              {scripts.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.name}
                </Select.Option>
              ))}
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchExecutions}
              disabled={!historyScriptId}
            >
              刷新
            </Button>
          </Space>
        </Col>
      </Row>
      {historyScriptId ? (
        <Table
          columns={columns}
          dataSource={executions}
          rowKey="id"
          loading={executionsLoading}
          pagination={{ pageSize: 20 }}
        />
      ) : (
        <Empty description="请先选择一个脚本查看执行历史" />
      )}
    </Card>
  );
};
