// @ts-ignore
import hljs from 'highlight.js';
import { marked } from 'marked';

// noinspection JSUnusedGlobalSymbols
export default defineNuxtPlugin((_nuxtApp) => {
  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function (code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartypants: false,
    xhtml: false,
  });

  // noinspection JSUnusedGlobalSymbols
  return {
    provide: {
      renderMarkdown: (id: string, markdown_content: string, options: marked.MarkedOptions = {}) => {
        return marked(markdown_content, options);
      },
    },
  };
});
