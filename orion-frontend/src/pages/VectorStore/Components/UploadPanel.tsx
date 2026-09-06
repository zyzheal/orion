/**
 * UploadPanel.tsx - 上传文档面板
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
import React from 'react';
import { Card, Form, Input, Select, Button, Space, Tooltip } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { VectorCollection } from '@/api/vector-store';

interface UploadPanelProps {
  collections: VectorCollection[];
  uploadContent: string;
  setUploadContent: (v: string) => void;
  uploadCollection: string | undefined;
  setUploadCollection: (v: string | undefined) => void;
  uploadMetadata: string;
  setUploadMetadata: (v: string) => void;
  uploadLoading: boolean;
  onUpload: () => void;
  onFileUpload: (file: File) => boolean;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({
  collections,
  uploadContent,
  setUploadContent,
  uploadCollection,
  setUploadCollection,
  uploadMetadata,
  setUploadMetadata,
  uploadLoading,
  onUpload,
  onFileUpload,
}) => (
  <Card title="上传文档">
    <Form layout="vertical">
      <Form.Item label="目标集合 (可选)">
        <Select
          placeholder="选择集合"
          allowClear
          value={uploadCollection}
          onChange={setUploadCollection}
          options={collections
            .filter((c) => c.status === 'active')
            .map((c) => ({ label: c.displayName, value: c.name }))}
        />
      </Form.Item>
      <Form.Item label="文档内容">
        <Input.TextArea
          rows={4}
          placeholder="输入或粘贴文档内容..."
          value={uploadContent}
          onChange={(e) => setUploadContent(e.target.value)}
        />
      </Form.Item>
      <Form.Item label="元数据 (JSON, 可选)">
        <Input.TextArea
          rows={2}
          placeholder='{"source": "file.md", "category": "docs"}'
          value={uploadMetadata}
          onChange={(e) => setUploadMetadata(e.target.value)}
        />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" icon={<UploadOutlined />} onClick={onUpload} loading={uploadLoading}>
            上传文档
          </Button>
          <Tooltip title="支持 .txt, .md, .json 等文本文件">
            <label>
              <Button icon={<UploadOutlined />}>选择文件</Button>
              <input
                type="file"
                accept=".txt,.md,.json,.yaml,.yml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileUpload(file);
                }}
              />
            </label>
          </Tooltip>
        </Space>
      </Form.Item>
    </Form>
  </Card>
);
