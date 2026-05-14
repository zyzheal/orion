# orion-knowledge 子应用改造说明

**状态**: 需要额外调研  
**技术栈**: Next.js + React 19 + MUI  
**复杂度**: 高

---

## 一、当前状态

### 技术架构

- **框架**: Next.js (App Router)
- **React 版本**: 19.2.3
- **UI 库**: @ctzhian/ui (基于 MUI)
- **包管理**: pnpm + monorepo
- **构建工具**: Next.js 内置

### 目录结构

```
orion-knowledge/web/
├── admin/          # 管理后台
├── app/           # 主应用 (Next.js App Router)
├── packages/      # 共享包
│   ├── icons/     # 图标库
│   ├── themes/    # 主题库
│   └── ui/        # UI 组件库
└── package.json   # monorepo 配置
```

---

## 二、wujie 适配挑战

### 2.1 Next.js 微前端限制

Next.js 的微前端接入相比 Vite/Webpack 应用更为复杂，主要因为：

1. **服务端渲染 (SSR)**: Next.js 默认开启 SSR，而 wujie 主要在客户端运行
2. **路由系统**: Next.js 使用文件系统路由，与 wujie 的路由管理有冲突
3. **构建输出**: Next.js 输出为 Node.js 服务，不是静态 UMD 包

### 2.2 可选方案

#### 方案 A: Next.js + wujie (实验性)

使用 `next-micro-frontend` 或自定义方案，需要：
- 禁用 SSR (`ssr: false`)
- 使用 `output: 'export'` 导出静态文件
- 配置 wujie 生命周期

**优点**: 保持 Next.js 特性
**缺点**: 配置复杂，部分 Next.js 特性不可用

#### 方案 B: 降级为 Create React App / Vite

如果 Next.js 特性不是必需的，可以考虑：
- 将核心页面迁移到 Vite + React
- 使用标准的 wujie 接入方式

**优点**: 微前端接入简单
**缺点**: 失去 Next.js 的 SSR/路由等特性

#### 方案 C: 使用 iframe 独立部署

作为临时方案：
- orion-knowledge 独立部署
- 主应用通过 iframe 嵌入

**优点**: 改动最小
**缺点**: 体验和集成度不如 wujie

---

## 三、推荐方案

鉴于 orion-knowledge 的复杂性和 Next.js 微前端的不成熟性，建议：

### 短期方案 (MVP 阶段)

1. **保持独立部署**: orion-knowledge 作为独立应用运行
2. **单点登录集成**: 通过 Token 实现认证互通
3. **导航集成**: 在主应用添加知识库导航入口
4. **新窗口打开**: 点击导航时在新窗口/标签页打开知识库

### 中期方案 (Phase 2)

1. **评估必要性**: 评估微前端集成的实际价值
2. **技术验证**: 进行 Next.js + wujie 的 POC 验证
3. **渐进式迁移**: 如确有必要，考虑将核心功能迁移到 Vite

### 长期方案 (Phase 3+)

1. **统一技术栈**: 如果前端技术栈统一为 React + Vite
2. **完整微前端集成**: 实现完整的 wujie 集成

---

## 四、改造清单 (当前暂不执行)

### 4.1 入口文件改造 (待 Next.js 方案成熟后)

```typescript
// src/app/provider/wujie-provider.tsx (待创建)
'use client';

import { useEffect } from 'react';

interface WujieProviderProps {
  children: React.ReactNode;
}

export function WujieProvider({ children }: WujieProviderProps) {
  useEffect(() => {
    // 标记为 wujie 子应用
    (window as any).__POWERED_BY_WUJIE__ = true;
    
    // 导出生命周期 (需要在主应用中调用)
    window.mount = (props: any) => {
      console.log('[orion-knowledge] mount', props);
    };
    
    window.unmount = () => {
      console.log('[orion-knowledge] unmount');
    };
    
    return () => {
      (window as any).__POWERED_BY_WUJIE__ = false;
    };
  }, []);
  
  return <>{children}</>;
}
```

### 4.2 Next.js 配置 (待 Next.js 方案成熟后)

```javascript
// next.config.js (待修改)
module.exports = {
  // 禁用 SSR 以支持微前端
  reactStrictMode: true,
  ssr: false,
  
  // 配置输出为静态
  output: 'export',
  
  // 配置 basePath
  basePath: '/orion-knowledge',
  
  // 配置 CORS
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
        ],
      },
    ];
  },
}
```

---

## 五、决策记录

**决策**: 暂不进行 orion-knowledge 微前端改造  
**原因**:
1. Next.js 微前端技术尚不成熟
2. MVP 阶段优先保证核心功能
3. 可采用独立部署 + SSO 方案替代

**后续行动**:
1. 在 F206 联调测试阶段，使用新窗口打开方案
2. 在 Phase 2 重新评估微前端集成的必要性
3. 如确有必要，进行技术验证和 POC

---

## 六、替代方案实施

### 6.1 主应用配置

```typescript
// orion-frontend/src/microfront/apps.ts
export const subAppConfigs: SubAppConfig[] = [
  // ... 其他子应用
  {
    name: '知识库',
    key: 'knowledge',
    path: '/knowledge/*',
    url: 'http://localhost:3002', // 独立部署地址
    container: '#wujie-knowledge',
    enabled: false, // 暂时禁用 wujie 集成
    openInNewTab: true, // 新窗口打开
  },
];
```

### 6.2 认证集成

- orion-knowledge 接受主应用传递的 Token
- 通过 URL 参数或 localStorage 共享认证状态

---

## 七、参考文档

- [Next.js 官方文档](https://nextjs.org/)
- [wujie 框架说明](https://wujie-micro.github.io/)
- [微前端与 Next.js](https://github.com/wujie-micro/wujie/issues)
