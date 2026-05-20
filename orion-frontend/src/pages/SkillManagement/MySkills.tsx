/**
 * My Skills - Installed skills list, upgrade available, uninstall
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Rate,
  Modal,
  message,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  ReloadOutlined as ReloadIcon,
  AppstoreOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getMySkills, uninstallSkill, type SkillPackage } from '@/api/skills';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const MySkills: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<SkillPackage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getMySkills();
      setSkills(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load installed skills：${error.message}`);
      } else {
        message.error('Failed to load installed skills');
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
        if (!skill.name.toLowerCase().includes(q) && !skill.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.category && filters.category !== 'all' && skill.category !== filters.category)
        return false;
      return true;
    });
  }, [searchQuery, filters, skills]);

  const handleUninstall = async (skill: SkillPackage) => {
    Modal.confirm({
      title: '确认卸载',
      content: `确定要卸载技能 "${skill.name}" 吗？`,
      okText: '卸载',
      okButtonProps: { danger: true },
      onOk: async () => {
        setUninstallingId(skill.id);
        try {
          await uninstallSkill(skill.id);
          message.success(`技能 "${skill.name}" 已卸载`);
          loadData();
        } catch (error: unknown) {
          if (error instanceof Error) {
            message.error(`卸载失败：${error.message}`);
          } else {
            message.error('卸载失败');
          }
        } finally {
          setUninstallingId(null);
        }
      },
    });
  };

  const columns: TableColumn<SkillPackage>[] = [
    {
      key: 'name',
      title: '技能名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: unknown) => <Tag>v{String(v)}</Tag>,
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => <StatusBadge status={v as any} size="small" />,
    },
    {
      key: 'rating',
      title: '评分',
      dataIndex: 'rating',
      width: 120,
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
      key: 'installedAt',
      title: '安装时间',
      dataIndex: 'createdAt',
      width: 160,
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
      width: 220,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() => navigate(`/skills/${record.id}/instances`)}
          >
            实例
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate(`/skills/${record.id}/executions`)}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReloadIcon />}
            onClick={() => navigate(`/skills/${record.id}/versions`)}
          >
            升级
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleUninstall(record)}
            loading={uninstallingId === record.id}
          >
            卸载
          </Button>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'category',
      label: '分类',
      options: [
        { label: '全部', value: 'all' },
        { label: 'CI/CD', value: 'ci-cd' },
        { label: '数据库', value: 'database' },
        { label: '监控', value: 'monitoring' },
        { label: '安全', value: 'security' },
        { label: 'AI/ML', value: 'ai-ml' },
        { label: '基础设施', value: 'infrastructure' },
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
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            我的技能
          </Title>
          <Text type="secondary">已安装的技能包管理</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="已安装技能" value={skills.length} suffix="个" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="活跃技能"
              value={skills.filter((s) => s.status === 'published').length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="平均评分"
              value={
                skills.length > 0 ? skills.reduce((sum, s) => sum + s.rating, 0) / skills.length : 0
              }
              precision={1}
              suffix="分"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索已安装的技能..."
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
    </div>
  );
};

export default MySkills;
