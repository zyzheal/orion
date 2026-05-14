import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const ServerError: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="500"
      title="500"
      subTitle="抱歉，服务器内部错误。"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>
          返回首页
        </Button>
      }
    />
  );
};

export default ServerError;
