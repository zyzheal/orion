/**
 * VersionsTab - 版本管理 Tab
 * 抽取自 index.tsx，含脚本选择器 + 版本表
 */
import React, { useMemo } from 'react';
import { Card, Row, Col, Select, Button, Table, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ScriptEntry, ScriptVersion } from '@/api/script-library';
import { buildVersionColumns } from './columns';

export interface VersionsTabProps {
  scripts: ScriptEntry[];
  selectedScript: ScriptEntry | null;
  setSelectedScript: (s: ScriptEntry | null) => void;
  versions: ScriptVersion[];
  versionsLoading: boolean;
  fetchVersions: (scriptId: string) => void;
  handleCreateVersion: () => void;
  handleRollback: (version: number) => void;
}

export const VersionsTab: React.FC<VersionsTabProps> = (props) => {
  const {
    scripts, selectedScript, setSelectedScript,
    versions, versionsLoading, fetchVersions,
    handleCreateVersion, handleRollback,
  } = props;

  const columns = useMemo(
    () => buildVersionColumns({ handleRollback }),
    [handleRollback]
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
          <Select
            placeholder="选择脚本查看版本"
            style={{ width: 300 }}
            showSearch
            optionFilterProp="children"
            onChange={(val) => {
              const script = scripts.find((s) => s.id === val) ?? null;
              setSelectedScript(script);
              fetchVersions(val);
            }}
          >
            {scripts.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                {s.name}
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateVersion}
            disabled={!selectedScript}
          >
            创建版本
          </Button>
        </Col>
      </Row>
      {selectedScript ? (
        <Table
          columns={columns}
          dataSource={versions}
          rowKey="id"
          loading={versionsLoading}
          pagination={false}
        />
      ) : (
        <Empty description="请先选择一个脚本" />
      )}
    </Card>
  );
};
