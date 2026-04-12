import '@/assets/fonts/font.css';
import '@/assets/styles/index.css';
import '@/assets/styles/markdown.css';
import { wrapWindowOpen } from './utils/getBasename';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
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
  const { container, basename } = props;

  const containerEl = container
    ? container.querySelector('#root')
    : document.querySelector('#root');

  if (!containerEl) return;

  root = createRoot(containerEl);

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter basename={basename || window.__BASENAME__}>
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
// Orion Context 定义
// ============================================
import { createContext } from 'react';

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
    // 全局初始化逻辑
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
