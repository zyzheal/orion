import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loading } from '@/components/Loading';

// 检查用户是否已登录
const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  // 检查 token 是否过期
  const expiresAt = localStorage.getItem('token_expires_at');
  if (expiresAt) {
    const now = new Date().getTime();
    if (now > parseInt(expiresAt, 10)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_expires_at');
      return false;
    }
  }

  return true;
};

const RootRedirect: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const auth = isAuthenticated();
    setLoggedIn(auth);
    setChecking(false);
  }, []);

  if (checking) {
    return <Loading fullscreen />;
  }

  if (loggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" state={{ from: { pathname: '/dashboard' } }} replace />;
};

export default RootRedirect;
