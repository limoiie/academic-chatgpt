import { AIChatMessage, HumanChatMessage } from 'langchain/schema';

export async function dummyDialogue($renderMarkdown: (arg0: string, arg1: string) => any) {
  return [
    {
      question: {
        username: 'LM',
        message: new HumanChatMessage('Oh, yes!'),
        rendered_content: await $renderMarkdown(
          '',
          `This is what I want
\`\`\`python
marked.setOptions({
  renderer: new marked.Renderer(),
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'python';
    const highlighted = hljs.highlight(code, { language }).value;
    console.log('highlighted:', highlighted);
    return highlighted;
  },
  langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
  pedantic: false,
  gfm: true,
  breaks: false,
  sanitize: false,
  smartypants: false,
  xhtml: false,
});
\`\`\``,
        ),
      },
      answers: [
        {
          username: 'ChatGPT',
          rendered_content: await $renderMarkdown('', 'Hello, world!'),
          message: new AIChatMessage('Oh, No!'),
        },
      ],
      chosen: 0,
    },
    {
      question: {
        username: 'LM',
        rendered_content: 'Yes',
        message: new HumanChatMessage('Oh, Yes!'),
      },
      answers: [
        {
          username: 'ChatGPT',
          rendered_content: 'No',
          message: new AIChatMessage('Oh, Yes!'),
        },
      ],
      chosen: 0,
    },
  ];
}
