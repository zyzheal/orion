import { http, HttpResponse } from 'msw';

export const handlers = [
  // 登录接口
  http.post('/api/auth/login', async ({ request }) => {
    const { username, password } = (await request.json()) as { username: string; password: string };

    if (username === 'admin' && password === 'admin123') {
      return HttpResponse.json({
        code: 0,
        message: 'success',
        data: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 3600,
          user: {
            id: '1',
            username: 'admin',
            email: 'admin@orion.com',
            role: 'admin',
            avatar: null,
          },
        },
      });
    }

    return HttpResponse.json(
      {
        code: 401,
        message: '用户名或密码错误',
        data: null,
      },
      { status: 401 }
    );
  }),

  // 获取当前用户
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        id: '1',
        username: 'admin',
        email: 'admin@orion.com',
        role: 'admin',
        avatar: null,
      },
    });
  }),

  // 登出接口
  http.post('/api/auth/logout', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: null,
    });
  }),

  // Dashboard 统计数据
  http.get('/api/dashboard/stats', () => {
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        totalProjects: 12,
        activePipelines: 8,
        totalUsers: 156,
        systemHealth: 'healthy',
      },
    });
  }),
];
