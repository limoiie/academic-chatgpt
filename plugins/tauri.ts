import { defineNuxtPlugin } from '#app';
import 'ant-design-vue/dist/antd.css';
import '~/plugins/tauri/aheadinjection';
import * as commands from '~/plugins/tauri/bindings';

export default defineNuxtPlugin((_nuxtApp) => {
  return {
    provide: {
      tauriCommands: commands,
    },
  };
});
