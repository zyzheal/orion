/**
 * 文档中心入口
 *
 * 左侧文档分类树 + 右侧文档列表 + 详情 + 同步面板
 */
import React, { useState, useEffect } from 'react';
import { Card, Typography } from 'antd';
import {
  FileTextOutlined,
} from '@ant-design/icons';
import DocTree from './DocTree';
import DocList from './DocList';
import DocDetail from './DocDetail';
import SyncPanel from './SyncPanel';
import type { DocType } from './DocTree';
import { getDocs } from '@/api/knowledge';
import type { KnowledgeDoc } from '@/api/knowledge';
import { colors } from '@/tokens';

const { Title, Paragraph } = Typography;

const DocumentCenter: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [selectedType, setSelectedType] = useState<DocType>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [syncVisible, setSyncVisible] = useState(false);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await getDocs();
      setDocs(Array.isArray(res) ? res : []);
    } catch {
      // API may not be fully ready
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  // Filter docs by type and tag
  const filteredDocs = docs.filter((doc) => {
    if (selectedType !== 'all' && doc.type !== selectedType) return false;
    if (selectedTag && !doc.tags?.includes(selectedTag)) return false;
    return true;
  });

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
        <SyncPanel visible={syncVisible} onClose={() => setSyncVisible(false)} />
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <Card style={{ width: 260, flexShrink: 0 }} styles={{ body: { padding: '12px' } }}>
          <DocTree
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
          />
        </Card>

        <Card style={{ flex: 1 }} styles={{ body: { padding: 0 } }}>
          {selectedDoc ? (
            <DocDetail
              doc={selectedDoc}
              loading={false}
              onBack={() => setSelectedDoc(null)}
              onRefresh={fetchDocs}
            />
          ) : (
            <DocList
              docs={filteredDocs}
              loading={loading}
              onSelectDoc={(doc) => setSelectedDoc(doc)}
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default DocumentCenter;
