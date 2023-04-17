// https://nuxt.com/docs/api/configuration/nuxt-config
// noinspection JSUnusedGlobalSymbols
export default defineNuxtConfig({
  css: ['highlight.js/styles/atom-one-dark.css'],
  modules: ['@nuxt/content', '@nuxt/ui', '@nuxtjs/color-mode', '@nuxtjs/tailwindcss', '@pinia/nuxt', '@/modules/antd'],
  plugins: ['@/plugins/antd', '@/plugins/localstore', '@/plugins/markdownd', '@/plugins/pdfjs'],
  ssr: false, // Disable Server Side Rendering as we want a desktop application,
  tailwindcss: {
    cssPath: '@/assets/scss/tailwind.scss',
  },
});
