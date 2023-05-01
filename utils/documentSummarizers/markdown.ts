import { TextSummarizer } from '~/utils/documentSummarizers/text';

export class MarkdownTextSummarizer extends TextSummarizer {
  async summarize() {
    const { text, metadata } = await this.open();
    const title = metadata.title || 'Untitled';
    return `This document "${title}" is a markdown file with ${text.length} characters.\
    Its metadata is:\n${JSON.stringify(metadata)}.`;
  }
}
