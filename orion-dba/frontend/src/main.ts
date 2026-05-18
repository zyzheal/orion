import { createApp } from 'vue';
import App from './App.vue';
import routes from '@/router';
import Antd from 'ant-design-vue';
import { store, key } from '@/store/index';
import i18n from '@/lang';
import CTable from '@/components/table/index';
import { extend } from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';

extend(weekday);
extend(localeData);

// 初始化主题
function initTheme() {
  if (localStorage.getItem('theme') === null) {
    import('@/style/theme.less');
    localStorage.setItem('theme', 'dark');
  } else {
    if (localStorage.getItem('theme') === 'dark') {
      import('@/style/theme.less');
    } else {
      import('@/style/light.less');
    }
  }
}

// 创建应用实例
function createOrionApp(props: any = {}) {
  initTheme();

  const app = createApp(App);

  // 注入 Orion 全局状态（如果存在）
  if (props?.$orion) {
    app.config.globalProperties.$orion = {
      user: props.$orion.user,
      permissions: props.$orion.permissions,
      token: props.$orion.token,
      apiBase: props.$orion.getApiBase?.() || '/api/v1/db',
      eventBus: props.$orion.eventBus,
    };
  }

  app.directive('watermark', (el, binding) => {
    addWaterMarker(binding.value.text);
  });

  app.use(i18n);
  app.use(store, key);
  app.use(Antd);
  app.use(CTable);
  app.use(routes);

  // 如果运行在 wujie 容器中，将 token 同步到 Vuex store（路由守卫依赖它）
  if (props?.$orion?.token) {
    store.commit('user/USER_STORE', {
      token: props.$orion.token,
      real_name: props.$orion.user?.name || '',
      user: props.$orion.user?.name || '',
      is_record: 2,
    });
  }

  return app;
}

let instance: any = null;

// 独立运行模式（微任务延迟，让 wujie 先设置标志位）
Promise.resolve().then(() => {
  if (!(window as any).__POWERED_BY_WUJIE__) {
    instance = createOrionApp();
    instance.mount('#app');
    console.log('[orion-dba-frontend] Running in standalone mode');

    // 监听来自主应用的 postMessage 消息（传递 token）
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'ORION_TOKEN') {
        console.log('[orion-dba-frontend] 收到 token:', event.data.token ? '已接收' : '无');

        (window as any).$orion = {
          token: event.data.token,
          apiBase: event.data.apiBase || '/api/v1/db',
          getApiBase: () => event.data.apiBase || '/api/v1/db',
        };

        if (event.data.token) {
          sessionStorage.setItem('jwt', event.data.token);
        }
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('orion_token');
    if (tokenFromUrl) {
      (window as any).$orion = {
        token: tokenFromUrl,
        apiBase: '/api/v1/db',
        getApiBase: () => '/api/v1/db',
      };
      sessionStorage.setItem('jwt', tokenFromUrl);
    }
  }
});

// wujie 生命周期
// wujie 通过 window.$wujie.props 传递 props（非 mount 参数）

export async function bootstrap() {
  console.log('[orion-dba-frontend] bootstrap');
}

function getWujieProps(): any {
  return (window as any).$wujie?.props || {};
}

export async function mount(_props: any) {
  const props = getWujieProps();
  console.log('[orion-dba-frontend] mount, wujie props:', props);

  window.__POWERED_BY_WUJIE__ = true;

  if (props?.$orion) {
    (window as any).$orion = props.$orion;
  }

  instance = createOrionApp(props);
  instance.mount('#orion-dba-app');
}

export async function unmount() {
  console.log('[orion-dba-frontend] unmount');
  if (instance) {
    instance.unmount();
    instance._container.innerHTML = '';
    instance = null;
  }
  window.__POWERED_BY_WUJIE__ = false;
}

// wujie 期望的 window 钩子
(function registerWujieLifecycle() {
  (window as any).__WUJIE_MOUNT = () => mount({});
  (window as any).__WUJIE_UNMOUNT = () => unmount();
})();

function addWaterMarker(text: string) {
  const id = '1.23452384164.123412415';
  if (document.getElementById(id) !== null) {
    document.body.removeChild(document.getElementById(id) as HTMLElement);
  }
  const can = document.createElement('canvas');
  can.width = 200;
  can.height = 100;

  const cans = can.getContext('2d') as CanvasRenderingContext2D;
  cans.rotate((-20 * Math.PI) / 180);
  cans.font = '20px Vedana';
  cans.fillStyle = '#4A4A4A';
  cans.textAlign = 'center';
  cans.textBaseline = 'middle';
  cans.fillText(text, can.width / 2, can.height);

  const div = document.createElement('div');
  div.id = id;
  div.style.pointerEvents = 'none';
  div.style.top = '40px';
  div.style.left = '0px';
  div.style.opacity = '0.1';
  div.style.position = 'fixed';
  div.style.zIndex = '100000';
  div.style.width = document.documentElement.clientWidth + 'px';
  div.style.height = document.documentElement.clientHeight + 'px';
  div.style.background =
    'url(' + can.toDataURL('image/png') + ') left top repeat';
  document.body.appendChild(div);
}
