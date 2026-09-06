/**
 * 运维工具 - 文件管理 Tab
 */
import React from 'react';
import { Card, Table, Button, Space } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import type { FileInfo } from '@/api/ops-tools';

interface FileTabProps {
  fileColumns: TableColumnsType<FileInfo>;
  files: FileInfo[];
  fileLoading: boolean;
  onRefresh: () => void;
  onUpload: () => void;
}

export const FileTab: React.FC<FileTabProps> = ({
  fileColumns,
  files,
  fileLoading,
  onRefresh,
  onUpload,
}) => (
  <Card
    title="文件上传/下载/分发"
    extra={
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
        <Button icon={<PlusOutlined />} onClick={onUpload}>
          上传文件
        </Button>
      </Space>
    }
  >
    <Table
      columns={fileColumns}
      dataSource={files}
      loading={fileLoading}
      rowKey="id"
      size="middle"
      pagination={{ pageSize: 10 }}
    />
  </Card>
);
