import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { login as loginApi, logout as logoutApi } from '@/api/auth';
import type { LoginRequest } from '@/api/types';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, setUser, setAuthenticated, setLoading, setTokens } =
    useAuthStore();

  const login = useCallback(
    async (data: LoginRequest) => {
      setLoading(true);
      try {
        const response = await loginApi(data);
        const { accessToken, refreshToken, user: userData, expiresAt } = response;

        // 保存 token 到 store 和 localStorage
        setTokens(accessToken, refreshToken, expiresAt);
        setUser(userData);

        return { success: true };
      } catch (error) {
        return { success: false, error };
      } finally {
        setLoading(false);
      }
    },
    [setUser, setAuthenticated, setLoading, setTokens]
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Logout failed silently
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setAuthenticated(false);
    }
  }, [setUser, setAuthenticated]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
};
