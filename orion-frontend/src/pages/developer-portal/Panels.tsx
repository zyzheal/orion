/**
 * Developer Portal — header actions and the four list-style tab panels.
 *
 * The playground tab composes the request/response builder from
 * PlaygroundPanel.tsx together with the saved-requests table.
 */
import type { ColumnsType } from 'antd/es/table';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Row,
  Col,
  Statistic,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type {
  PortalDocument,
  MockRule,
  SDKGenerationTask,
  APISubscription,
} from '@/api/developer-portal';
import { colors, spacing } from '@/tokens';
import { TAB_KEYS, EMPTY_STATES } from './constants';
import type { TabKey } from './types';

const { Search } = Input;

// ==================== Shared bits ====================

interface Pagination {
  current: number;
  pageSize: number;
  total: number;
}

/** Shared table pagination props for all five tabs. */
function tablePagination(page: Pagination, onChange: (p: number) => void) {
  return {
    ...page,
    showSizeChanger: true,
    showTotal: (t: number) => `共 ${t} 条`,
    onChange,
  };
}

interface EmptyWithCreateProps {
  description: string;
  buttonText: string;
  onCreate: () => void;
}

/** Empty state used by the four list tabs, always paired with a create action. */
function EmptyWithCreate({ description, buttonText, onCreate }: EmptyWithCreateProps) {
  return (
    <Empty description={description}>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        {buttonText}
      </Button>
    </Empty>
  );
}

// ==================== Header Actions ====================

interface HeaderActionsProps {
  activeTab: TabKey;
  loading: boolean;
  onOpenCreateDoc: () => void;
  onOpenCreateMock: () => void;
  onOpenCreateSdk: () => void;
  onOpenCreateSub: () => void;
  onRefresh: () => void;
}

export function HeaderActions({
  activeTab,
  loading,
  onOpenCreateDoc,
  onOpenCreateMock,
  onOpenCreateSdk,
  onOpenCreateSub,
  onRefresh,
}: HeaderActionsProps) {
  const createButtonHandlers: Record<TabKey, () => void> = {
    docs: onOpenCreateDoc,
    mock: onOpenCreateMock,
    sdk: onOpenCreateSdk,
    subscriptions: onOpenCreateSub,
    playground: onOpenCreateDoc,
  };

  const visibleCreateButtons: { tab: TabKey; label: string }[] = [
    { tab: TAB_KEYS.DOCS, label: '创建文档' },
    { tab: TAB_KEYS.MOCK, label: '添加规则' },
    { tab: TAB_KEYS.SDK, label: '生成 SDK' },
    { tab: TAB_KEYS.SUBSCRIPTIONS, label: '申请订阅' },
  ].filter((b) => b.tab === activeTab);

  return (
    <Space>
      {visibleCreateButtons.map((b) => (
        <Button
          key={b.tab}
          type="primary"
          icon={<PlusOutlined />}
          onClick={createButtonHandlers[b.tab]}
        >
          {b.label}
        </Button>
      ))}
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </Space>
  );
}

// ==================== Tab: API Documents ====================

export interface DocTabStats {
  total: number;
  published: number;
  draft: number;
  inReview: number;
  totalViews: number;
  totalHelpful: number;
}

interface DocumentsTabProps {
  stats: DocTabStats;
  loading: boolean;
  columns: ColumnsType<PortalDocument>;
  dataSource: PortalDocument[];
  pagination: Pagination;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSearch: (page: number, search?: string) => void;
  onOpenCreateDoc: () => void;
}

export function DocumentsTab({
  stats,
  loading,
  columns,
  dataSource,
  pagination,
  searchText,
  onSearchTextChange,
  onSearch,
  onOpenCreateDoc,
}: DocumentsTabProps) {
  return (
    <>
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="文档总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="已发布"
              value={stats.published}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="草稿" value={stats.draft} valueStyle={{ color: colors.neutral[500] }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="审核中"
              value={stats.inReview}
              valueStyle={{ color: colors.warning[500] }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总浏览" value={stats.totalViews} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总点赞"
              value={stats.totalHelpful}
              prefix={<StarOutlined style={{ color: colors.warning[500] }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <Search
            placeholder="搜索文档..."
            allowClear
            style={{ width: 400 }}
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            onSearch={(v) => (v.trim() ? onSearch(1, v.trim()) : onSearch(1))}
          />
        </div>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          loading={loading}
          pagination={tablePagination(pagination, (p) => onSearch(p))}
          locale={{
            emptyText: (
              <EmptyWithCreate
                description={EMPTY_STATES.docs}
                buttonText="创建文档"
                onCreate={onOpenCreateDoc}
              />
            ),
          }}
        />
      </Card>
    </>
  );
}

// ==================== Tab: Mock Service ====================

export interface MockTabStats {
  total: number;
  enabled: number;
  disabled: number;
}

interface MockServiceTabProps {
  stats: MockTabStats;
  loading: boolean;
  columns: ColumnsType<MockRule>;
  dataSource: MockRule[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onOpenCreateMock: () => void;
}

export function MockServiceTab({
  stats,
  loading,
  columns,
  dataSource,
  pagination,
  onPageChange,
  onOpenCreateMock,
}: MockServiceTabProps) {
  return (
    <>
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="规则总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="已启用"
              value={stats.enabled}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="已禁用" value={stats.disabled} valueStyle={{ color: colors.neutral[500] }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          loading={loading}
          pagination={tablePagination(pagination, onPageChange)}
          locale={{
            emptyText: (
              <EmptyWithCreate
                description={EMPTY_STATES.mock}
                buttonText="添加规则"
                onCreate={onOpenCreateMock}
              />
            ),
          }}
        />
      </Card>
    </>
  );
}

// ==================== Tab: SDK Generator ====================

export interface SdkTabStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

interface SdkTabProps {
  stats: SdkTabStats;
  loading: boolean;
  columns: ColumnsType<SDKGenerationTask>;
  dataSource: SDKGenerationTask[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onOpenCreateSdk: () => void;
}

export function SdkTab({
  stats,
  loading,
  columns,
  dataSource,
  pagination,
  onPageChange,
  onOpenCreateSdk,
}: SdkTabProps) {
  return (
    <>
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="任务总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: colors.success[500] }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="生成中"
              value={stats.pending}
              valueStyle={{ color: colors.primary[500] }}
              prefix={<SyncOutlined spin />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: colors.error[500] }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          loading={loading}
          pagination={tablePagination(pagination, onPageChange)}
          locale={{
            emptyText: (
              <EmptyWithCreate
                description={EMPTY_STATES.sdk}
                buttonText="生成 SDK"
                onCreate={onOpenCreateSdk}
              />
            ),
          }}
        />
      </Card>
    </>
  );
}

// ==================== Tab: Subscriptions ====================

export interface SubTabStats {
  totalSubscriptions: number;
  approved: number;
  pending: number;
  rejected: number;
  suspended: number;
}

interface SubscriptionsTabProps {
  stats: SubTabStats;
  loading: boolean;
  columns: ColumnsType<APISubscription>;
  dataSource: APISubscription[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onOpenCreateSub: () => void;
}

export function SubscriptionsTab({
  stats,
  loading,
  columns,
  dataSource,
  pagination,
  onPageChange,
  onOpenCreateSub,
}: SubscriptionsTabProps) {
  return (
    <>
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={5}>
          <Card size="small">
            <Statistic title="订阅总数" value={stats.totalSubscriptions} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="已通过"
              value={stats.approved}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="待审批"
              value={stats.pending}
              valueStyle={{ color: colors.warning[500] }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="已拒绝"
              value={stats.rejected}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="已暂停" value={stats.suspended} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey="id"
          loading={loading}
          pagination={tablePagination(pagination, onPageChange)}
          locale={{
            emptyText: (
              <EmptyWithCreate
                description={EMPTY_STATES.subscriptions}
                buttonText="申请订阅"
                onCreate={onOpenCreateSub}
              />
            ),
          }}
        />
      </Card>
    </>
  );
}
