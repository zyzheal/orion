import React from 'react';
import { Spin } from 'antd';

interface AuthInitializerProps {
  children: React.ReactNode;
}

export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('[AuthInitializer] Error:', error);
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }
};
