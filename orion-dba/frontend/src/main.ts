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

// 微前端：判断是否运行在 wujie 容器中
const isWujieSubApp = !!window.__POWERED_BY_WUJIE__;

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

  return app;
}

let instance: any = null;

// 独立运行模式
if (!isWujieSubApp) {
  instance = createOrionApp();
  instance.mount('#app');
  console.log('[orion-dba-frontend] Running in standalone mode');
}

// wujie 生命周期导出
export async function bootstrap() {
  console.log('[orion-dba-frontend] bootstrap');
}

export async function mount(props: any) {
  console.log('[orion-dba-frontend] mount with props:', props);

  // 标记为 wujie 子应用
  window.__POWERED_BY_WUJIE__ = true;

  // 存储全局状态
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

function addWaterMarker(text: string) {
  const id = '1.23452384164.123412415';
  if (document.getElementById(id) !== null) {
    document.body.removeChild(document.getElementById(id) as HTMLElement);
  }
  const can = document.createElement('canvas');
  // 设置 canvas 画布大小
  can.width = 200;
  can.height = 100;

  const cans = can.getContext('2d') as CanvasRenderingContext2D;
  cans.rotate((-20 * Math.PI) / 180); // 水印旋转角度
  cans.font = '20px Vedana';
  cans.fillStyle = '#4A4A4A';
  cans.textAlign = 'center';
  cans.textBaseline = 'middle';
  cans.fillText(text, can.width / 2, can.height); // 水印在画布的位置 x，y 轴

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
