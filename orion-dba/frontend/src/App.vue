<template>
  <a-config-provider :locale="lang">
    <router-view />
  </a-config-provider>
</template>

<script lang="ts" setup>
  import zhCN from 'ant-design-vue/es/locale/zh_CN';
  import enUS from 'ant-design-vue/es/locale/en_US';
  import { locale } from 'dayjs';
  import 'dayjs/locale';
  import { onMounted, ref } from 'vue';
  import { systemLang } from './apis/loginApi';
  import i18n from '@/lang';

  const lang = ref();

  onMounted(async () => {
    // 微前端：如果运行在 Orion 中，使用 Orion 的语言设置
    const orionLang = window.$orion?.user?.language;
    
    if (orionLang) {
      locale(orionLang);
      sessionStorage.setItem('lang', orionLang);
      i18n.global.locale.value = orionLang;
      lang.value = orionLang === 'en_US' ? enUS : zhCN;
    } else {
      const { data } = await systemLang();
      locale(data.payload);
      sessionStorage.setItem('lang', data.payload);
      i18n.global.locale.value = data.payload;
      lang.value = data.payload === 'en_US' ? enUS : zhCN;
    }
  });
</script>
