/**
 * DetailTabs - 右侧详情 Tabs（团队/活动/权限）
 * 抽取自 index.tsx (P2-9 Phase 206)
 */
import { Card, Tabs, List, Avatar, Tag, Space, Typography, Empty } from 'antd';
import { TeamOutlined, HistoryOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { UserProfile, UserTeam, UserActivity } from '@/api/user';

const { Text } = Typography;

interface Props {
  profile: UserProfile | null;
  teams: UserTeam[];
  activities: UserActivity[];
}

export const DetailTabs = ({ profile, teams, activities }: Props) => (
  <Card>
    <Tabs
      items={[
        {
          key: 'teams',
          label: (
            <span>
              <TeamOutlined /> 所属团队
            </span>
          ),
          children:
            teams.length > 0 ? (
              <List
                dataSource={teams}
                renderItem={(team) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<TeamOutlined />} />}
                      title={team.name}
                      description={`角色: ${team.role}`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无团队信息" />
            ),
        },
        {
          key: 'activities',
          label: (
            <span>
              <HistoryOutlined /> 最近活动
            </span>
          ),
          children:
            activities.length > 0 ? (
              <List
                dataSource={activities.slice(0, 10)}
                renderItem={(activity) => (
                  <List.Item>
                    <List.Item.Meta
                      title={activity.action}
                      description={
                        <Space>
                          {activity.resourceType && <Tag>{activity.resourceType}</Tag>}
                          <Text type="secondary">
                            {new Date(activity.createdAt).toLocaleString('zh-CN')}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无活动记录" />
            ),
        },
        {
          key: 'permissions',
          label: (
            <span>
              <SafetyCertificateOutlined /> 权限
            </span>
          ),
          children:
            profile?.permissions && profile.permissions.length > 0 ? (
              <List
                dataSource={profile.permissions}
                renderItem={(perm) => (
                  <List.Item>
                    <List.Item.Meta
                      title={perm.resource}
                      description={
                        <Space>
                          {perm.actions.map((a) => (
                            <Tag key={a} color="blue">
                              {a}
                            </Tag>
                          ))}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无权限信息" />
            ),
        },
      ]}
    />
  </Card>
);
