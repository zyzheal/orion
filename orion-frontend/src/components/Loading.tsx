import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingProps {
  fullscreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ fullscreen = false }) => {
  const indicator = <LoadingOutlined style={{ fontSize: 36 }} spin />;

  if (fullscreen) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
        }}
      >
        <Spin indicator={indicator} size="large" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 0',
      }}
    >
      <Spin indicator={indicator} />
    </div>
  );
};
