/**
 * SelectionPanel - 配置选择面板 (Config select + version selects + compare button)
 * 抽取自 index.tsx (P2-9 Phase 122)
 */
import React from 'react';
import { Card, Row, Col, Select, Space, Button, Descriptions } from 'antd';
import { DiffOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ConfigDiffState } from '../useConfigDiffState';

const { Option } = Select;

interface SelectionPanelProps {
  state: ConfigDiffState;
}

export const SelectionPanel: React.FC<SelectionPanelProps> = ({ state }) => {
  const {
    configs,
    selectedConfigId,
    selectedConfig,
    fromVersion,
    toVersion,
    configLoading,
    versionOptions,
    diffLoading,
    handleCompare,
    setSelectedConfigId,
    setSelectedConfig,
    setFromVersion,
    setToVersion,
  } = state;

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Row gutter={spacing.md} align="middle">
        <Col flex="auto">
          <Select
            labelInValue
            placeholder="Select a config"
            style={{ width: 320 }}
            loading={configLoading}
            value={selectedConfigId ? { key: selectedConfigId } : undefined}
            onChange={(val) => {
              if (val?.key) {
                setSelectedConfigId(val.key);
                setSelectedConfig(configs.find((c) => c.id === val.key) || null);
              }
            }}
          >
            {configs.map((c) => (
              <Option key={c.id} value={c.id}>
                {c.key} [{c.environment}] (v{c.version})
              </Option>
            ))}
          </Select>
        </Col>
        <Col>
          {selectedConfig && (
            <Descriptions size="small" column={2} style={{ width: 'auto' }}>
              <Descriptions.Item label="Category">{selectedConfig.category}</Descriptions.Item>
              <Descriptions.Item label="Status">{selectedConfig.status}</Descriptions.Item>
            </Descriptions>
          )}
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="From version"
              style={{ width: 240 }}
              value={fromVersion || undefined}
              onChange={setFromVersion}
              disabled={!selectedConfigId}
            >
              {versionOptions.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="To version"
              style={{ width: 240 }}
              value={toVersion || undefined}
              onChange={setToVersion}
              disabled={!selectedConfigId}
            >
              {versionOptions.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<DiffOutlined />}
              onClick={handleCompare}
              loading={diffLoading}
              disabled={!fromVersion || !toVersion}
            >
              Compare
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );
};
