/**
 * DocumentManager - Upload document panel
 */
import React from 'react';
import { Card, Form, Input, Select, Button, Space, Tooltip, message, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { VectorCollection } from '@/api/vector-store';

interface DocumentManagerProps {
  collections: VectorCollection[];
  uploadContent: string;
  uploadCollection: string | undefined;
  uploadMetadata: string;
  uploadLoading: boolean;
  onContentChange: (value: string) => void;
  onCollectionChange: (value: string | undefined) => void;
  onMetadataChange: (value: string) => void;
  onUpload: () => void;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({
  collections,
  uploadContent,
  uploadCollection,
  uploadMetadata,
  uploadLoading,
  onContentChange,
  onCollectionChange,
  onMetadataChange,
  onUpload,
}) => {
  const handleFileUpload: UploadProps['beforeUpload'] = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onContentChange(text.substring(0, 10000));
      onMetadataChange(JSON.stringify({ source: file.name }, null, 2));
      message.success(`文件 ${file.name} 已读取`);
    };
    reader.readAsText(file);
    return false;
  };

  return (
    <Card title="上传文档">
      <Form layout="vertical">
        <Form.Item label="目标集合 (可选)">
          <Select
            placeholder="选择集合"
            allowClear
            value={uploadCollection}
            onChange={onCollectionChange}
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
            onChange={(e) => onContentChange(e.target.value)}
          />
        </Form.Item>
        <Form.Item label="元数据 (JSON, 可选)">
          <Input.TextArea
            rows={2}
            placeholder='{"source": "file.md", "category": "docs"}'
            value={uploadMetadata}
            onChange={(e) => onMetadataChange(e.target.value)}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={onUpload}
              loading={uploadLoading}
            >
              上传文档
            </Button>
            <Tooltip title="支持 .txt, .md, .json 等文本文件">
              <Upload
                accept=".txt,.md,.json,.yaml,.yml"
                showUploadList={false}
                beforeUpload={handleFileUpload}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Tooltip>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default DocumentManager;
