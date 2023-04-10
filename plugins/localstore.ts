import { defineNuxtPlugin } from '#app';
import { Store } from 'tauri-plugin-store-api';

// noinspection JSUnusedGlobalSymbols
export default defineNuxtPlugin((_nuxtApp) => {
  const tauriStore = new Store('.settings.dat');
  return {
    provide: {
      tauriStore,
    },
  };
});
