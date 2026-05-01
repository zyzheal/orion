import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { getCurrentUser } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';

interface AuthInitializerProps {
  children: React.ReactNode;
}

export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('access_token');
      if (!token) {
        useAuthStore.getState().logout();
        setInitialized(true);
        return;
      }

      try {
        const response = await getCurrentUser();
        setUser({
          id: response.id,
          username: response.username,
          email: response.email,
          role: response.role,
          avatar: response.avatar,
        });
        setAuthenticated(true);
      } catch {
        // Token invalid — clear and let ProtectedRoute redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token_expires_at');
        useAuthStore.getState().logout();
      } finally {
        setInitialized(true);
      }
    }
    init();
  }, [setUser, setAuthenticated]);

  if (!initialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" tip="正在验证身份..." />
      </div>
    );
  }

  return <>{children}</>;
};
