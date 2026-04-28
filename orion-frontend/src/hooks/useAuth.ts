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
      console.log('[Auth] Attempting login with:', { username: data.username });
      try {
        const response = await loginApi(data);
        const { accessToken, refreshToken, user: userData, expiresAt } = response;

        console.log('[Auth] Login successful, token received:', {
          accessToken: accessToken ? 'yes' : 'no',
          expiresAt,
          user: userData?.username,
        });

        // 保存 token 到 store 和 localStorage
        setTokens(accessToken, refreshToken, expiresAt);
        setUser(userData);

        console.log('[Auth] Tokens saved to store and localStorage');

        return { success: true };
      } catch (error) {
        console.error('[Auth] Login failed:', error);
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
    } catch (error) {
      console.error('Logout failed:', error);
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
