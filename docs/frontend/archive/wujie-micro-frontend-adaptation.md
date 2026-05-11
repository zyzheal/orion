# Wujie 微前端适配方案

> 版本：1.0 | 创建日期：2026-04-11 | 适用项目：Orion Platform

---

## 一、适配概述

### 1.1 待改造系统清单

| 系统 | 路径 | 框架 | UI 库 | 状态 |
|------|------|------|-------|------|
| orion-dba | `/orion-dba/frontend` | Vue 3.2 | Ant Design Vue 3.2 | ✅ 已完成 |
| orion-knowledge | `/orion-knowledge/web/admin` | React 18 | MUI | ⏳ 待改造 |
| orion-visor | `/orion-visor/orion-visor-ui` | Vue 3.5 | Arco Design 5.x | ⏳ 待改造 |

### 1.2 改造内容

1. 入口文件改造 - 添加独立运行/微前端嵌入双模式
2. 构建配置 - 输出 UMD 格式，配置外部依赖
3. 样式隔离 - CSS Modules/Scoped CSS + Less 变量前缀
4. 通信协议 - Props + Custom Events + $orion 全局状态
5. API 调用 - getApiBase() 封装 + X-Orion-Token Header

---

## 二、orion-knowledge 适配方案

### 2.1 入口文件改造

```tsx
// src/main.tsx
import react from '@vitejs/plugin-react';
import { createRoot, Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import store from './store';

// ============================================
// 微前端标识：判断是否运行在 Orion 容器中
// ============================================
const isOrionChild = !!window.__POWERED_BY_ORION__;

// ============================================
// 应用实例引用
// ============================================
let root: Root | null = null;

// ============================================
// 渲染应用
// ============================================
function render(props: any = {}) {
  const { container } = props;
  
  const containerEl = container 
    ? container.querySelector('#root') 
    : document.querySelector('#root');
    
  if (!containerEl) return;

  root = createRoot(containerEl);
  
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter basename={window.__BASENAME__ || props.basename}>
          {/* 注入 Orion 全局状态到 Context */}
          <OrionContext.Provider value={props}>
            <App />
          </OrionContext.Provider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );
}

// ============================================
// 独立运行模式（开发环境）
// ============================================
if (!isOrionChild) {
  render();
  console.log('[orion-knowledge] Running in standalone mode');
} else {
  // ============================================
  // 微前端子应用模式（生产环境，嵌入 Orion）
  // ============================================
  
  /**
   * 生命周期：初始化
   * 在子应用首次加载前调用，可用于全局初始化逻辑
   */
  export async function bootstrap() {
    console.log('[orion-knowledge] bootstrap');
    // 可在此处进行全局变量初始化、SDK 加载等
  }

  /**
   * 生命周期：挂载
   * 主应用调用此方法将子应用渲染到指定容器
   * @param props - 主应用传递的属性
   */
  export async function mount(props: any) {
    console.log('[orion-knowledge] mount with props:', props);
    render(props);
  }

  /**
   * 生命周期：卸载
   * 主应用调用此方法销毁子应用实例，释放资源
   */
  export async function unmount() {
    console.log('[orion-knowledge] unmount');
    root?.unmount();
    root = null;
    // 清理事件监听器、定时器等
  }
}
```

### 2.2 构建配置改造

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, Plugin } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isMicroFrontend = mode === 'micro-frontend';
  
  return {
    base: isMicroFrontend ? '/orion-knowledge/' : '/',
    
    build: {
      assetsDir: 'orion-knowledge-admin-assets',
      
      // 微前端模式：输出为 UMD 格式
      ...(isMicroFrontend && {
        lib: {
          entry: path.resolve(__dirname, 'src/main.tsx'),
          name: 'orion-knowledge-app',
          fileName: () => 'orion-knowledge-app.js',
          formats: ['umd'],
        },
        cssCodeSplit: false,
        sourcemap: true,
        rollupOptions: {
          external: ['react', 'react-dom', 'react-router-dom', 'react-redux', '@reduxjs/toolkit', '@mui/material'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react-router-dom': 'ReactRouterDOM',
              'react-redux': 'ReactRedux',
              '@reduxjs/toolkit': 'ReduxToolkit',
              '@mui/material': 'MaterialUI',
            },
          },
        },
      }),
      
      // 通用配置
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-redux', '@reduxjs/toolkit'],
            'vendor-mui': ['@mui/material'],
            'vendor-echarts': ['echarts'],
          },
        },
      },
    },
    
    server: {
      port: 3020,
      cors: true,
      proxy: {
        '/api': {
          target: env.TARGET,
          secure: false,
          changeOrigin: true,
        },
      },
    },
    
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  };
});
```

### 2.3 新增命令

```json
{
  "scripts": {
    "dev": "vite",
    "dev:mf": "vite --mode micro-frontend",
    "build": "tsc -b && vite build",
    "build:mf": "tsc -b && vite build --mode micro-frontend"
  }
}
```

---

## 三、orion-visor 适配方案

### 3.1 入口文件改造

```ts
// src/main.ts
import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import ArcoVueIcon from '@arco-design/web-vue/es/icon';
import globalComponents from '@/components';
import router from './router';
import store from './store';
import i18n from './locale';
import directive from './directive';
import '@/assets/style/global.less';
import '@/assets/style/layout.less';
import App from './App.vue';
import globalErrorHandler from '@/utils/monitor';

// ============================================
// 微前端标识：判断是否运行在 Orion 容器中
// ============================================
const isOrionChild = !!window.__POWERED_BY_ORION__;

// ============================================
// 初始化主题
// ============================================
function initTheme() {
  // 主题初始化逻辑
}

// ============================================
// 创建应用实例
// ============================================
function createOrionApp(props: any = {}) {
  initTheme();
  
  const app = createApp(App);
  
  // 注入 Orion 全局状态（如果存在）
  if (props) {
    app.config.globalProperties.$orion = {
      user: props.user,
      permissions: props.permissions,
      token: props.token,
      apiBase: props.apiBase || '/api/v1/visor',
      navigateTo: props.navigateTo,
    };
  }
  
  app.use(ArcoVue);
  app.use(ArcoVueIcon);
  app.use(router);
  app.use(store);
  app.use(i18n);
  app.use(globalComponents);
  app.use(directive);
  
  // 全局异常处理
  globalErrorHandler(app);
  
  return app;
}

// ============================================
// 独立运行模式（开发环境）
// ============================================
if (!isOrionChild) {
  const app = createOrionApp();
  app.mount('#app');
  console.log('[orion-visor] Running in standalone mode');
} else {
  // ============================================
  // 微前端子应用模式（生产环境，嵌入 Orion）
  // ============================================
  let instance: any = null;

  /**
   * 生命周期：初始化
   */
  export async function bootstrap() {
    console.log('[orion-visor] bootstrap');
  }

  /**
   * 生命周期：挂载
   */
  export async function mount(props: any) {
    console.log('[orion-visor] mount with props:', props);
    
    instance = createOrionApp(props);
    instance.mount('#orion-visor-app');
  }

  /**
   * 生命周期：卸载
   */
  export async function unmount() {
    console.log('[orion-visor] unmount');
    instance?.unmount();
    instance = null;
  }
}
```

### 3.2 构建配置改造

```ts
// config/vite.config.base.ts
import { resolve } from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import svgLoader from 'vite-svg-loader';
import configArcoStyleImportPlugin from './plugin/arcoStyleImport';
import configPwaPlugin from './plugin/pwa';

export default defineConfig({
  base: '/visor/',
  
  build: {
    // 微前端：输出为 UMD 格式
    lib: {
      entry: resolve(__dirname, '../src/main.ts'),
      name: 'orion-visor-app',
      fileName: () => 'orion-visor-app.js',
      formats: ['umd'],
    },
    // 微前端：关闭 CSS 代码分割
    cssCodeSplit: false,
    // 微前端：生成 sourcemap 便于调试
    sourcemap: true,
    
    rollupOptions: {
      // 避免将 Vue 等依赖打包到库中
      external: ['vue', '@arco-design/web-vue'],
      output: {
        globals: {
          vue: 'Vue',
          '@arco-design/web-vue': 'ArcoVue',
        },
      },
    },
  },
  
  plugins: [
    vue(),
    vueJsx(),
    svgLoader({ svgoConfig: {} }),
    configArcoStyleImportPlugin(),
    configPwaPlugin(),
  ],
  
  resolve: {
    alias: [
      {
        find: '@',
        replacement: resolve(__dirname, '../src'),
      },
    ],
  },
});
```

### 3.3 新增命令

```json
{
  "scripts": {
    "dev": "vite --config ./config/vite.config.dev.ts",
    "dev:mf": "vite --config ./config/vite.config.dev.ts --mode micro-frontend",
    "build": "vue-tsc --noEmit && vite build --config ./config/vite.config.prod.ts",
    "build:mf": "vue-tsc --noEmit && vite build --config ./config/vite.config.prod.ts --mode micro-frontend"
  }
}
```

---

## 四、样式隔离规范

### 4.1 Less 变量前缀

各子应用必须使用应用前缀：

```less
// orion-knowledge: 变量前缀 kb-
@kb-primary-color: #722ed1;
@kb-font-size-base: 14px;

// orion-visor: 变量前缀 visor-
@visor-primary-color: #00b2ff;
@visor-font-size-base: 14px;
```

### 4.2 Scoped CSS（Vue）

```vue
<template>
  <div class="visor-panel">
    <h3>监控面板</h3>
  </div>
</template>

<style scoped lang="less">
.visor-panel {
  h3 {
    color: @visor-text-color;
  }
}
</style>
```

### 4.3 CSS Modules（React）

```tsx
// Panel.module.less
.panel {
  background: @kb-bg-color;
}
```

```tsx
// Panel.tsx
import styles from './Panel.module.less';

function Panel() {
  return <div className={styles.panel}>内容</div>;
}
```

---

## 五、通信协议

### 5.1 $orion 全局状态接口

```ts
interface OrionGlobalState {
  // 用户信息
  user: {
    id: number;
    username: string;
    email: string;
    avatar?: string;
  };
  
  // 权限列表
  permissions: string[];
  
  // 认证 Token
  token: string;
  
  // API 基础路径
  apiBase: string;
  
  // 可选：主应用提供的方法
  navigateTo?: (path: string) => void;
  showMessage?: (type: 'success' | 'error', message: string) => void;
}
```

### 5.2 Custom Events

```ts
// 子应用发送事件
window.dispatchEvent(
  new CustomEvent('orion-child-event', {
    detail: {
      source: 'orion-knowledge',
      type: 'NAVIGATE',
      data: { path: '/doc/list' },
    },
  })
);
```

---

## 六、本地开发调试

### 6.1 独立模式

```bash
# orion-knowledge
cd orion-knowledge/web/admin
npm run dev

# orion-visor
cd orion-visor/orion-visor-ui
npm run dev
```

### 6.2 微前端模式联调

```bash
# 终端 1：启动主应用
cd orion-visor/orion-visor-ui
npm run dev

# 终端 2：启动子应用（微前端模式）
cd orion-knowledge/web/admin
npm run dev:mf
```

---

## 七、检查清单

### orion-knowledge

- [ ] 入口文件添加 `isOrionChild` 判断
- [ ] 导出 `bootstrap`/`mount`/`unmount` 生命周期
- [ ] 构建配置支持 UMD 输出
- [ ] 配置外部依赖（react, mui 等）
- [ ] 添加 `build:mf` 命令
- [ ] 样式隔离检查
- [ ] API 调用适配（getApiBase, X-Orion-Token）
- [ ] 功能回归测试

### orion-visor

- [ ] 入口文件添加 `isOrionChild` 判断
- [ ] 导出 `bootstrap`/`mount`/`unmount` 生命周期
- [ ] 构建配置支持 UMD 输出
- [ ] 配置外部依赖（vue, arco-design）
- [ ] 添加 `build:mf` 命令
- [ ] 样式隔离检查
- [ ] API 调用适配（getApiBase, X-Orion-Token）
- [ ] 功能回归测试

---

_文档维护：Orion 前端团队 | 最后更新：2026-04-11_
