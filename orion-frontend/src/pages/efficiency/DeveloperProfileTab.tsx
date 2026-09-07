/**
 * DeveloperProfileTab.tsx - 开发者画像 Tab
 * 抽取自 efficiency/EfficiencyPage.tsx (P2-9 Phase 76)
 */
import React, { useEffect } from 'react';
import { Typography, Table, Tag, Space, Alert, Progress, Avatar, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useQuery } from '@/providers/QueryProvider';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { getDeveloperProfiles, type DeveloperProfile } from '@/api/efficiency';

const { Text } = Typography;

const DeveloperProfileTab: React.FC = () => {
  const { data: profiles = [] as DeveloperProfile[], isLoading: loading, isError, error } =
    useQuery<DeveloperProfile[]>({
      queryKey: ['efficiency-developer-profiles'],
      queryFn: async () => {
        const res = await getDeveloperProfiles();
        return res.data?.profiles || [];
      },
      staleTime: 30_000,
    });

  // 错误反馈
  useEffect(() => {
    if (!isError) return;
    message.error(`加载开发者画像失败: ${(error as Error)?.message}`);
  }, [isError, error]);

  const columns = [
    {
      title: '开发者',
      key: 'name',
      width: 160,
      render: (_: unknown, record: DeveloperProfile) => (
        <Space>
          <Avatar style={{ backgroundColor: colors.primary[500] }} icon={<UserOutlined />}>
            {record.name.charAt(0)}
          </Avatar>
          <Space direction="vertical" size={0}>
            <Text strong>{record.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.role}
            </Text>
          </Space>
        </Space>
      ),
    },
    { title: '团队', dataIndex: 'team', key: 'team', width: 80 },
    {
      title: '提交数',
      dataIndex: 'commits',
      key: 'commits',
      width: 80,
      render: (v: number) => <Text strong>{v}</Text>,
    },
    { title: 'PR数', dataIndex: 'prs', key: 'prs', width: 60 },
    { title: '评审数', dataIndex: 'reviews', key: 'reviews', width: 80 },
    {
      title: '修复Bug',
      dataIndex: 'bugsFixed',
      key: 'bugsFixed',
      width: 80,
      render: (v: number) => <Text style={{ color: colors.success[500] }}>{v}</Text>,
    },
    {
      title: '平均评审时间',
      dataIndex: 'avgReviewTime',
      key: 'avgReviewTime',
      width: 120,
      render: (v: number) => `${v} 分钟`,
    },
    {
      title: '代码质量',
      dataIndex: 'codeQuality',
      key: 'codeQuality',
      width: 120,
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={
            v >= 90 ? colors.success[500] : v >= 80 ? colors.primary[500] : colors.warning[500]
          }
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: '活跃天数',
      dataIndex: 'activeDays',
      key: 'activeDays',
      width: 80,
      render: (v: number) => `${v}/22`,
    },
    {
      title: '专长',
      key: 'specialty',
      render: (_: unknown, record: DeveloperProfile) => (
        <Space wrap>
          {record.specialty.slice(0, 2).map((s: string, i: number) => (
            <Tag key={String(i)} color="blue" style={{ fontSize: 11 }}>
              {s}
            </Tag>
          ))}
          {record.specialty.length > 2 && (
            <Tag style={{ fontSize: 11 }}>+{record.specialty.length - 2}</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md }}>
        <Text type="secondary">开发者画像基于近期活动数据自动生成，用于识别效能瓶颈和优势</Text>
      </div>
      <Alert
        message="数据说明"
        description="开发者画像基于 Git 提交、PR 评审、Bug 修复等公开数据生成，仅用于团队效能分析，不作个人绩效考评依据"
        type="info"
        showIcon
        style={{ marginBottom: spacing.md }}
      />
      <Table
        columns={columns}
        dataSource={profiles}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default DeveloperProfileTab;
