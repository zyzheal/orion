import { Button, Input, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

interface Props {
  projectId: string;
  onSearchProject: (val: string) => void;
  onRefresh: () => void;
  onOpenAdd: () => void;
}

export function PageHeader({ projectId, onSearchProject, onRefresh, onOpenAdd }: Props) {
  return (
    <Space>
      <Input.Search
        placeholder="输入项目ID"
        defaultValue={projectId}
        onSearch={onSearchProject}
        style={{ width: 200 }}
      />
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        刷新
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onOpenAdd}>
        添加成员
      </Button>
    </Space>
  );
}
