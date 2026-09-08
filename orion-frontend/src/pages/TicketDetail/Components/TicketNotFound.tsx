import { Button, Result } from 'antd';

interface Props {
  id: string | undefined;
  onBack: () => void;
}

export function TicketNotFound({ id, onBack }: Props) {
  return (
    <Result
      status="404"
      title="工单不存在"
      subTitle={`未找到工单 ${id}`}
      extra={
        <Button type="primary" onClick={onBack}>
          返回工单列表
        </Button>
      }
      data-testid="ticket-not-found"
    />
  );
}
