import '@/assets/fonts/font.css';
import '@/assets/styles/index.css';
import '@/assets/styles/markdown.css';
import React, { createContext } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { wrapWindowOpen } from './utils/getBasename';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import App from './App';
import store from './store';

// Window 类型已在 getBasename.ts 中统一声明

// ============================================
// Orion 全局状态接口
// ============================================
export interface OrionGlobalState {
  user?: {
    id: number;
    username: string;
    email: string;
    avatar?: string;
    department?: string;
  };
  permissions?: string[];
  token?: string;
  apiBase?: string;
  basename?: string;
  navigateTo?: (path: string) => void;
  showMessage?: (type: 'success' | 'error', message: string) => void;
}

export const OrionContext = createContext<OrionGlobalState>({});

// ============================================
// 渲染应用
// ============================================
function render(props: any = {}) {
  const { container, basename } = props;

  const containerEl = container
    ? container.querySelector('#root')
    : document.querySelector('#root');

  if (!containerEl) return null;

  // 复用已存在的 React root
  let existingRoot: Root | null = null;
  try {
    existingRoot = (containerEl as any).__reactRoot || null;
  } catch { /* ignore */ }

  let root: Root;
  if (existingRoot) {
    root = existingRoot;
  } else {
    root = createRoot(containerEl);
    (containerEl as any).__reactRoot = root;
  }

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter basename={basename || window.__BASENAME__ || '/'}>
          <OrionContext.Provider value={props}>
            <App />
          </OrionContext.Provider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );

  return root;
}

// ============================================
// 独立运行模式（微任务延迟，让 wujie 先设置标志位）
// ============================================
let knowledgeRoot: Root | null = null;

Promise.resolve().then(() => {
  if (!(window as any).__POWERED_BY_WUJIE__) {
    // 动态加载 CSS 文件
    const loadCSS = (href: string) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    };

    loadCSS(`${window.__BASENAME__}/orion-knowledge.css`);

    wrapWindowOpen(window.__BASENAME__ || '');
    dayjs.extend(duration);
    dayjs.extend(relativeTime);
    dayjs.locale('zh-cn');

    knowledgeRoot = render();
    console.log('[orion-knowledge] Running in standalone mode');
  }
});

// ============================================
// wujie 生命周期
// wujie 通过 window.$wujie.props 传递 props（非 mount 参数）
// ============================================

async function doBootstrap() {
  console.log('[orion-knowledge] bootstrap');
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  dayjs.locale('zh-cn');
}

function getWujieProps(): any {
  return (window as any).$wujie?.props || {};
}

async function doMount(_props: any) {
  const props = getWujieProps();
  console.log('[orion-knowledge] mount, wujie props:', props);

  window.__POWERED_BY_WUJIE__ = true;

  // wujie iframe 中可能没有 #root 元素，需要动态创建
  let rootEl = document.getElementById('root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);
    console.log('[orion-knowledge] Created #root element dynamically');
  }

  knowledgeRoot = render({ ...props, container: document });
}

async function doUnmount() {
  console.log('[orion-knowledge] unmount');
  if (knowledgeRoot) {
    knowledgeRoot.unmount();
    knowledgeRoot = null;
  }
  window.__POWERED_BY_WUJIE__ = false;
}

// 导出 ES module 生命周期（用于构建后产物）
export { doBootstrap as bootstrap, doMount as mount, doUnmount as unmount };

// 挂载到 window（用于 Vite dev 模式，wujie 从全局读取）
(window as any).bootstrap = doBootstrap;
(window as any).mount = doMount;
(window as any).unmount = doUnmount;
