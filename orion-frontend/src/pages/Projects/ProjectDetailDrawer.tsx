/**
 * ProjectDetailDrawer.tsx - 项目详情抽屉
 * 抽取自 Projects/index.tsx (P2-9 Phase 83)
 */
import React from 'react';
import { Drawer, Tag, Descriptions, Space, Typography, Table as AntTable, Avatar } from 'antd';
import { FolderOutlined, TeamOutlined, EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { Project, ProjectResource } from '@/api/projects';
import { statusColorMap, statusLabelMap } from './constants';
import { projectResourceColumns } from './ProjectColumns';

const { Title, Text } = Typography;

interface ProjectDetailDrawerProps {
  visible: boolean;
  selectedProject: Project | null;
  projectResources: ProjectResource[];
  onClose: () => void;
}

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  visible,
  selectedProject,
  projectResources,
  onClose,
}) => (
  <Drawer
    title={
      selectedProject ? (
        <Space>
          <FolderOutlined style={{ color: colors.primary[500] }} />
          <span>{selectedProject.name}</span>
          <Tag color={statusColorMap[selectedProject.status]}>
            {statusLabelMap[selectedProject.status]}
          </Tag>
        </Space>
      ) : (
        '项目详情'
      )
    }
    open={visible}
    onClose={onClose}
    width={800}
    destroyOnClose
  >
    {selectedProject && (
      <>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.lg }}>
          <Descriptions.Item label="项目名称">{selectedProject.name}</Descriptions.Item>
          <Descriptions.Item label="Slug">{selectedProject.slug}</Descriptions.Item>
          <Descriptions.Item label="负责人">
            <Space>
              <Avatar size="small" style={{ backgroundColor: colors.primary[500] }}>
                {selectedProject.teamLead?.charAt(0) || '?'}
              </Avatar>
              {selectedProject.teamLead || '-'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColorMap[selectedProject.status]}>
              {statusLabelMap[selectedProject.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="团队成员" span={2}>
            <Space wrap>
              {selectedProject.teamMembers?.map((m: string) => (
                <Tag key={m} icon={<TeamOutlined />}>
                  {m}
                </Tag>
              )) || '-'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="环境" span={2}>
            <Space>
              {selectedProject.environments?.map((env: string) => (
                <Tag key={env} color="blue" icon={<EnvironmentOutlined />}>
                  {env}
                </Tag>
              )) || '-'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {selectedProject.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            <Text type="secondary">
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {dayjs(selectedProject.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            <Text type="secondary">
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {dayjs(selectedProject.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Title level={5} style={{ marginBottom: spacing[3] }}>
          关联资源
        </Title>
        <AntTable
          columns={projectResourceColumns}
          dataSource={projectResources}
          rowKey="id"
          size="small"
          locale={{ emptyText: '暂无关联资源' }}
        />
      </>
    )}
  </Drawer>
);
