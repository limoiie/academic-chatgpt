import { GlobalWorkerOptions, version } from 'pdfjs-dist';
// @ts-ignore
// noinspection ES6UnusedImports
import * as _used from 'pdfjs-dist/build/pdf.worker.entry';

// noinspection JSUnusedGlobalSymbols
export default defineNuxtPlugin((_nuxtApp) => {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.js`;

  return {
    provide: {},
  };
});
