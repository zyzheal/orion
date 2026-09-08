import { Card, Table, Button, Empty } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { spacing } from '@/tokens';

interface Props {
  tasks: any[];
  taskColumns: any[];
  recentPipelineRecords: any[];
  pipelineColumns: any[];
}

export function MainColumn({ tasks, taskColumns, recentPipelineRecords, pipelineColumns }: Props) {
  const navigate = useNavigate();

  return (
    <>
      <Card
        title="待处理任务"
        extra={<Button type="link">查看全部</Button>}
        style={{ marginBottom: spacing.md }}
      >
        {tasks.length > 0 ? (
          <Table columns={taskColumns} dataSource={tasks} pagination={false} size="small" />
        ) : (
          <Empty description="暂无待处理任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      <Card
        title="最近 Pipeline 执行"
        extra={
          <Button type="link" onClick={() => navigate('/pipeline-runs')}>
            查看全部
          </Button>
        }
      >
        {recentPipelineRecords.length > 0 ? (
          <Table
            columns={pipelineColumns}
            dataSource={recentPipelineRecords}
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="暂无 Pipeline 运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => navigate('/pipelines/new')}
            >
              创建 Pipeline
            </Button>
          </Empty>
        )}
      </Card>
    </>
  );
}
