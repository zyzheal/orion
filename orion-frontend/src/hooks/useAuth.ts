import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { login as loginApi, logout as logoutApi } from '@/api/auth';
import type { LoginRequest } from '@/api/types';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, setUser, setAuthenticated, setLoading } =
    useAuthStore();

  const login = useCallback(
    async (data: LoginRequest) => {
      setLoading(true);
      try {
        const response = await loginApi(data);
        const { accessToken, refreshToken, user } = response;

        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);

        setUser(user);
        setAuthenticated(true);

        return { success: true };
      } catch (error) {
        console.error('Login failed:', error);
        return { success: false, error };
      } finally {
        setLoading(false);
      }
    },
    [setUser, setAuthenticated, setLoading]
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
