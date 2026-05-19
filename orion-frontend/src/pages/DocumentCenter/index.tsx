/**
 * 文档中心入口
 *
 * 左侧文档分类树 + 右侧文档列表 + 详情 + 同步面板
 */
import React, { useState } from 'react';
import { Card, Typography, Splitter } from 'antd';
import {
  FileTextOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import DocTree from './DocTree';
import DocList from './DocList';
import DocDetail from './DocDetail';
import SyncPanel from './SyncPanel';
import { colors } from '@/tokens';

const { Title, Paragraph } = Typography;

export interface DocItem {
  id: string;
  title: string;
  type: 'design' | 'spec' | 'runbook' | 'policy';
  space: string;
  tags: string[];
  updatedAt: string;
  source: 'manual' | 'synced';
  content?: string;
  toc?: Array<{ id: string; title: string; level: number }>;
}

const DocumentCenter: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string>('all');

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
            文档中心
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>浏览、搜索和管理项目设计文档、规范和运维手册</Paragraph>
        </div>
        <SyncPanel />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <Card style={{ width: 260, flexShrink: 0 }} styles={{ body: { padding: '12px' } }}>
          <DocTree
            selectedSpace={selectedSpace}
            onSelect={(space) => setSelectedSpace(space)}
          />
        </Card>

        <Card style={{ flex: 1 }} styles={{ body: { padding: 0 } }}>
          {selectedDoc ? (
            <DocDetail doc={selectedDoc} onBack={() => setSelectedDoc(null)} />
          ) : (
            <DocList
              space={selectedSpace}
              onDocSelect={(doc) => setSelectedDoc(doc)}
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default DocumentCenter;
