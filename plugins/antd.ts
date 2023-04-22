import { defineNuxtPlugin } from '#app';
import Antd from 'ant-design-vue';
import '@/assets/scss/antd.scss';

// noinspection JSUnusedGlobalSymbols
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Antd);
});
