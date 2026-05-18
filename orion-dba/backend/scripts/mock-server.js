#!/usr/bin/env node

/**
 * Mock DBA Backend Server
 * 提供前端开发所需的 mock API
 */

const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8090;

const MOCK_RESPONSE = {
  '/login': {
    code: 0,
    text: '',
    payload: {
      token: 'mock-jwt-token',
      user: { username: 'admin', role: 'admin' },
    },
  },
  '/fetch': {
    code: 0,
    text: '',
    payload: {
      reg: false,
    },
  },
  '/lang': {
    code: 0,
    text: '',
    payload: {
      user: {
        form: { title: '登录', username: '用户名', password: '密码' },
      },
      common: {
        signin: '登录',
        about: '关于',
        community: '社区',
        sponsor: '赞助',
        statement: '声明',
        'stmt.title': '声明',
        'sponsor.title': '赞助商',
      },
    },
  },
  '/oidc/state': {
    code: 0,
    text: '',
    payload: {
      enabled: false,
    },
  },
};

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Orion-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[Mock] ${req.method} ${pathname}`);

  // 检查是否是 mock API
  const mockKey = Object.keys(MOCK_RESPONSE).find(key => pathname === key || pathname.endsWith(key));
  if (mockKey) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MOCK_RESPONSE[mockKey]));
    return;
  }

  // 其他请求返回 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ code: 404, text: 'Not Found' }));
}

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`Mock DBA Backend Server running on http://localhost:${PORT}`);
  console.log('Available mock endpoints:');
  console.log('  - POST /login');
  console.log('  - GET /fetch');
  console.log('  - GET /lang');
  console.log('  - GET /oidc/state');
});