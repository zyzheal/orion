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
// 微前端标识：判断是否运行在 Orion 容器中
// ============================================
const isOrionChild = !!window.__POWERED_BY_ORION__;

// ============================================
// 应用实例引用
// ============================================
let knowledgeRoot: Root | null = null;

// ============================================
// 渲染应用
// ============================================
function render(props: any = {}) {
  const { container, basename } = props;

  const containerEl = container
    ? container.querySelector('#root')
    : document.querySelector('#root');

  if (!containerEl) return;

  // 复用已存在的 React root
  let existingRoot: Root | null = null;
  try {
    existingRoot = (containerEl as any).__reactRoot || null;
  } catch { /* ignore */ }

  if (existingRoot) {
    knowledgeRoot = existingRoot;
  } else {
    knowledgeRoot = createRoot(containerEl);
    (containerEl as any).__reactRoot = knowledgeRoot;
  }

  knowledgeRoot.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter basename={basename || window.__BASENAME__}>
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
  // 动态加载 CSS 文件
  const loadCSS = (href: string) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  loadCSS(`${window.__BASENAME__ || ''}/orion-knowledge.css`);
  wrapWindowOpen(window.__BASENAME__ || '');
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  dayjs.locale('zh-cn');

  render();
  console.log('[orion-knowledge] Running in standalone mode');
}

// ============================================
// 微前端子应用生命周期（用于 Module Federation）
// ============================================

/**
 * 生命周期：初始化
 * 在子应用首次加载前调用，可用于全局初始化逻辑
 */
export async function bootstrap() {
  console.log('[orion-knowledge] bootstrap');
  dayjs.extend(duration);
  dayjs.extend(relativeTime);
  dayjs.locale('zh-cn');
}

/**
 * 生命周期：挂载
 * 主应用调用此方法将子应用渲染到指定容器
 * @param props - 主应用传递的属性
 */
export async function mount(props: any) {
  console.log('[orion-knowledge] mount with props:', props);

  window.__POWERED_BY_ORION__ = true;

  // 容器中可能没有 #root 元素，需要动态创建
  let rootEl = document.getElementById('root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);
    console.log('[orion-knowledge] Created #root element dynamically');
  }

  render({ ...props, container: document });
}

/**
 * 生命周期：卸载
 * 主应用调用此方法销毁子应用实例，释放资源
 */
export async function unmount() {
  console.log('[orion-knowledge] unmount');
  if (knowledgeRoot) {
    knowledgeRoot.unmount();
    knowledgeRoot = null;
  }
  window.__POWERED_BY_ORION__ = false;
}

// 挂载到 window（用于 Vite dev 模式）
(window as any).bootstrap = bootstrap;
(window as any).mount = mount;
(window as any).unmount = unmount;