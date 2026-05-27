/**
 * Skill Marketplace - Browse skills by category, search, filter by tags/rating/downloads
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Rate, Modal, message } from 'antd';
import { ReloadOutlined, DownloadOutlined, ShopOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getSkills, installSkill, type SkillPackage } from '@/api/skills';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const categoryOptions = [
  { label: '全部', value: 'all' },
  { label: 'CI/CD', value: 'ci-cd' },
  { label: '数据库', value: 'database' },
  { label: '监控', value: 'monitoring' },
  { label: '安全', value: 'security' },
  { label: 'AI/ML', value: 'ai-ml' },
  { label: '基础设施', value: 'infrastructure' },
];

const SkillMarketplace: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<SkillPackage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillPackage | null>(null);
  const [installing, setInstalling] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getSkills();
      setSkills(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load skills：${error.message}`);
      } else {
        message.error('Failed to load skills');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !skill.name.toLowerCase().includes(q) &&
          !skill.description.toLowerCase().includes(q) &&
          !skill.author.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.category && filters.category !== 'all' && skill.category !== filters.category)
        return false;
      if (filters.status && filters.status !== 'all' && skill.status !== filters.status)
        return false;
      return true;
    });
  }, [searchQuery, filters, skills]);

  const handleInstall = async (skill: SkillPackage) => {
    setInstalling(true);
    try {
      await installSkill(skill.id);
      message.success(`技能 "${skill.name}" 安装成功`);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`安装失败：${error.message}`);
      } else {
        message.error('安装失败');
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleViewDetail = (skill: SkillPackage) => {
    setSelectedSkill(skill);
    setDetailModalVisible(true);
  };

  const columns: TableColumn<SkillPackage>[] = [
    {
      key: 'name',
      title: '技能名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => handleViewDetail(record)}
          >
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.description.slice(0, 40)}...
          </Text>
        </Space>
      ),
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'tags',
      title: '标签',
      dataIndex: 'tags',
      width: 200,
      render: (v: unknown) => (
        <Space size={4} wrap>
          {Array.isArray(v) ? v.slice(0, 3).map((tag) => <Tag key={tag}>{tag}</Tag>) : null}
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => <StatusBadge status={String(v) as 'published' | 'draft' | 'archived'} size="small" />,
    },
    {
      key: 'rating',
      title: '评分',
      dataIndex: 'rating',
      width: 120,
      sortable: true,
      render: (v: unknown) => <Rate disabled defaultValue={Number(v)} />,
    },
    {
      key: 'installCount',
      title: '安装量',
      dataIndex: 'installCount',
      width: 100,
      sortable: true,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'author',
      title: '作者',
      dataIndex: 'author',
      width: 120,
      render: (v: unknown) => <Text>{String(v)}</Text>,
    },
    {
      key: 'createdAt',
      title: '发布时间',
      dataIndex: 'createdAt',
      width: 140,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: SkillPackage) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleInstall(record)}
            loading={installing}
          >
            安装
          </Button>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'category',
      label: '分类',
      options: categoryOptions,
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '已发布', value: 'published' },
        { label: '草稿', value: 'draft' },
        { label: '已归档', value: 'archived' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ShopOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            技能市场
          </Title>
          <Text type="secondary">浏览和安装社区共享的技能包</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索技能名称、描述、作者..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredSkills}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Skill Detail Modal */}
      <Modal
        title={selectedSkill?.name}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="install"
            type="primary"
            icon={<DownloadOutlined />}
            loading={installing}
            onClick={() => selectedSkill && handleInstall(selectedSkill)}
          >
            安装
          </Button>,
        ]}
        width={600}
      >
        {selectedSkill && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="blue">{selectedSkill.category}</Tag>
              <StatusBadge status={selectedSkill.status as 'published' | 'draft' | 'archived'} size="small" />
              <Rate disabled defaultValue={selectedSkill.rating} />
              <Text type="secondary">安装量: {selectedSkill.installCount}</Text>
            </Space>
            <Text>{selectedSkill.description}</Text>
            <div style={{ marginTop: 16 }}>
              <Text strong>标签: </Text>
              <Space size={4}>
                {selectedSkill.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text strong>作者: </Text>
              <Text>{selectedSkill.author}</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text strong>版本: </Text>
              <Text>v{selectedSkill.version}</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text strong>发布时间: </Text>
              <Text type="secondary">
                {dayjs(selectedSkill.createdAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SkillMarketplace;
