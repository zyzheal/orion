/**
 * ScriptsTab - 脚本列表 Tab
 * 抽取自 index.tsx，含分类/类型筛选 + 表格
 */
import React, { useMemo } from 'react';
import { Card, Row, Col, Space, Select, Button, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ScriptEntry } from '@/api/script-library';
import { scriptTypeLabel } from './config';
import { buildScriptColumns } from './columns';

export interface ScriptsTabProps {
  scripts: ScriptEntry[];
  scriptsLoading: boolean;
  filterCategory: string | undefined;
  setFilterCategory: (v: string | undefined) => void;
  filterType: string | undefined;
  setFilterType: (v: string | undefined) => void;
  categoryOptions: string[];
  fetchScripts: () => void;
  handleCreateScript: () => void;
  handleViewDetail: (record: ScriptEntry) => void;
  handleOpenExecute: (record: ScriptEntry) => void;
  handleEditScript: (record: ScriptEntry) => void;
  handleDeleteScript: (id: string) => void;
}

export const ScriptsTab: React.FC<ScriptsTabProps> = (props) => {
  const {
    scripts, scriptsLoading,
    filterCategory, setFilterCategory, filterType, setFilterType,
    categoryOptions, fetchScripts,
    handleCreateScript, handleViewDetail, handleOpenExecute, handleEditScript, handleDeleteScript,
  } = props;

  const columns = useMemo(
    () => buildScriptColumns({
      handleViewDetail, handleOpenExecute, handleEditScript, handleDeleteScript,
    }),
    [handleViewDetail, handleOpenExecute, handleEditScript, handleDeleteScript]
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
              placeholder="按分类筛选"
              allowClear
              style={{ width: 160 }}
              value={filterCategory}
              onChange={setFilterCategory}
            >
              {categoryOptions.map((cat) => (
                <Select.Option key={cat} value={cat}>
                  {cat}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="按类型筛选"
              allowClear
              style={{ width: 160 }}
              value={filterType}
              onChange={setFilterType}
            >
              {Object.entries(scriptTypeLabel).map(([val, label]) => (
                <Select.Option key={val} value={val}>
                  {label}
                </Select.Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchScripts}>
              刷新
            </Button>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateScript}>
            创建脚本
          </Button>
        </Col>
      </Row>
      <Table
        columns={columns}
        dataSource={scripts}
        rowKey="id"
        loading={scriptsLoading}
        pagination={{ pageSize: 20 }}
      />
    </Card>
  );
};
