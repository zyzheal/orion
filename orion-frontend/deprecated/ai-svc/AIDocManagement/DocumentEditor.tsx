/**
 * Document Editor - Markdown editor, version history
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Input,
  Select,
  message,
  Table as AntTable,
  Row,
  Col,
} from 'antd';
import { SaveOutlined, HistoryOutlined, ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import StatusBadge from '@/components/StatusBadge';
import { getDocs, updateDoc, type Document } from '@/api/ai-docs';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DocVersion {
  version: number;
  updatedAt: string;
  updatedBy: string;
  comment?: string;
}

const DocumentEditor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<DocVersion[]>([]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await getDocs();
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setDocuments([
        {
          id: 'd1',
          spaceId: 's1',
          title: 'API 设计最佳实践',
          content: '# API 设计最佳实践\n\n本文档介绍了 RESTful API 的设计原则...',
          status: 'published',
          version: 3,
          tags: ['api', 'design'],
          authorId: 'admin',
          createdAt: '2024-01-15',
          updatedAt: '2024-03-10',
        },
        {
          id: 'd2',
          spaceId: 's1',
          title: 'Kubernetes 运维手册',
          content: '# Kubernetes 运维手册\n\nK8s 日常运维操作指南...',
          status: 'published',
          version: 5,
          tags: ['k8s', 'ops'],
          authorId: 'admin',
          createdAt: '2024-02-01',
          updatedAt: '2024-03-15',
        },
      ]);
      if (error instanceof Error) {
        message.warning(`加载文档失败，使用模拟数据：${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleSelectDoc = (doc: Document) => {
    setSelectedDoc(doc);
    setTitle(doc.title);
    setContent(doc.content);
    setStatus(doc.status);
  };

  const handleSave = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      await updateDoc(selectedDoc.id, { title, content, status });
      message.success('文档已保存');
      loadDocuments();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`保存失败：${error.message}`);
      } else {
        message.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLoadVersions = () => {
    // Mock version history
    setVersions([
      {
        version: 3,
        updatedAt: dayjs().subtract(1, 'day').toISOString(),
        updatedBy: 'admin',
        comment: '更新 API 示例',
      },
      {
        version: 2,
        updatedAt: dayjs().subtract(3, 'day').toISOString(),
        updatedBy: 'admin',
        comment: '添加错误码说明',
      },
      {
        version: 1,
        updatedAt: dayjs().subtract(7, 'day').toISOString(),
        updatedBy: 'admin',
        comment: '初始版本',
      },
    ]);
    setShowVersions(true);
  };

  const versionColumns: ColumnsType<DocVersion> = [
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 80,
      render: (v: unknown) => <Tag>v{String(v)}</Tag>,
    },
    {
      key: 'comment',
      title: '变更说明',
      dataIndex: 'comment',
      width: 200,
      render: (v: unknown) => <Text>{String(v || '-')}</Text>,
    },
    {
      key: 'updatedBy',
      title: '修改人',
      dataIndex: 'updatedBy',
      width: 100,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'updatedAt',
      title: '修改时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (v: unknown) => <Text type="secondary">{dayjs(String(v)).fromNow()}</Text>,
    },
  ];

  if (!selectedDoc) {
    return (
      <div style={{ padding: 0 }}>
        <Title level={2} style={{ marginBottom: spacing.md }}>
          <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          文档编辑器
        </Title>
        <Card title="选择要编辑的文档" loading={loading}>
          {documents.map((doc) => (
            <Card
              key={doc.id}
              size="small"
              hoverable
              style={{ marginBottom: spacing.sm, cursor: 'pointer' }}
              onClick={() => handleSelectDoc(doc)}
            >
              <Space>
                <Text strong>{doc.title}</Text>
                <Tag>v{doc.version}</Tag>
                <StatusBadge status={doc.status === 'archived' ? 'cancelled' : doc.status === 'published' ? 'success' : 'pending'} />
              </Space>
            </Card>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedDoc(null)}>
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            {selectedDoc.title}
          </Title>
        </Space>
        <Space>
          <Button icon={<HistoryOutlined />} onClick={handleLoadVersions}>
            版本历史
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: spacing.md }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: 400 }}
            placeholder="文档标题"
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Published', value: 'published' },
              { label: 'Archived', value: 'archived' },
            ]}
          />
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={showVersions ? 16 : 24}>
          <Card title="Markdown 编辑器" bodyStyle={{ padding: 0 }}>
            <TextArea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={24}
              style={{ border: 'none', padding: spacing.md, resize: 'none', fontFamily: 'monospace' }}
              placeholder="输入 Markdown 内容..."
            />
          </Card>
        </Col>
        {showVersions && (
          <Col span={8}>
            <Card
              title="版本历史"
              extra={
                <Button size="small" onClick={() => setShowVersions(false)}>
                  收起
                </Button>
              }
            >
              <AntTable
                columns={versionColumns}
                dataSource={versions}
                rowKey="version"
                size="small"
                pagination={false}
              />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default DocumentEditor;
