/**
 * DataSourcePanel.tsx - Assistant 数据源接通演示面板
 * 抽取自 Assistant/index.tsx (P2-9 Phase 66)
 */
import React from 'react';
import { Space, Select, Button, Tag } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import type { SourceSamples } from './types';
import { SOURCE_SAMPLES } from './constants';

interface DataSourcePanelProps {
  importSource: SourceSamples;
  setImportSource: (v: SourceSamples) => void;
  ingesting: boolean;
  handleIngest: () => void;
}

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  importSource,
  setImportSource,
  ingesting,
  handleIngest,
}) => {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={10}>
      <Space>
        <Select
          value={importSource.source}
          onChange={(v) =>
            setImportSource(SOURCE_SAMPLES.find((s) => s.source === v) ?? SOURCE_SAMPLES[0])
          }
          style={{ width: 120 }}
          options={SOURCE_SAMPLES.map((s) => ({ label: s.label, value: s.source }))}
        />
        <Button
          type="primary"
          size="small"
          icon={<ImportOutlined />}
          loading={ingesting}
          onClick={handleIngest}
        >
          {`导入${importSource.label}样例`}
        </Button>
      </Space>
      <Space wrap>
        {importSource.items.map((item, idx) => (
          <Tag key={String(idx)} color="blue">
            {item.title}
          </Tag>
        ))}
      </Space>
    </Space>
  );
};
